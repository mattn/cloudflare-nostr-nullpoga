"use strict";

// テスト可能な純粋関数群。
// Worker 固有のグローバル(caches など)やネットワークに依存しないものだけをここに置く。
// index.ts と test/ の双方から import される。

import type { Event } from "nostr-tools";
import { getEventHash, getPublicKey, nip19, signEvent } from "nostr-tools";

// 反応してほしくない人の npub/pubkey 集合を環境変数から作る。
export function parseBlockedPubkeys(
    env: { NULLPOGA_BLOCKED_PUBKEYS?: string },
): Set<string> {
    const set = new Set<string>();
    for (const item of (env.NULLPOGA_BLOCKED_PUBKEYS || "").split(/[,\s]+/)) {
        const v = item.trim();
        if (v === "") continue;
        try {
            set.add(v.startsWith("npub1") ? nip19.decode(v).data as string : v);
        } catch (_e) {
            // 不正な npub は無視
        }
    }
    return set;
}

export function bearerAuthentication(request: Request, secret: string) {
    if (!request.headers.has("authorization")) {
        return false;
    }
    const authorization = request.headers.get("Authorization")!;
    const [scheme, encoded] = authorization.split(" ");
    return scheme === "Bearer" && encoded === secret;
}

export function createLike(nsec: string, mention: Event): Event {
    const decoded = nip19.decode(nsec);
    const sk = decoded.data as string;
    const pk = getPublicKey(sk);
    const created_at = mention.created_at + 1;
    let event = {
        id: "",
        kind: 7,
        pubkey: pk,
        created_at: created_at, // Math.floor(Date.now() / 1000),
        tags: [["e", mention.id]],
        content: "🩷",
        sig: "",
    };
    event.id = getEventHash(event);
    event.sig = signEvent(event, sk);

    return event;
}

export function createReplyWithTags(
    nsec: string,
    mention: Event,
    message: string,
    tags: string[][],
    notice: boolean = true,
): Event {
    const decoded = nip19.decode(nsec);
    const sk = decoded.data as string;
    const pk = getPublicKey(sk);
    if (mention.pubkey === pk) throw new Error("Self reply not acceptable");
    const tt = [];
    if (notice) tt.push(["e", mention.id], ["p", mention.pubkey]);
    else tt.push(["e", mention.id]);
    if (mention.kind === 42) {
        for (let tag of mention.tags.filter((x: any[]) => x[0] === "e")) {
            tt.push(tag);
        }
    }
    for (let tag of tags) {
        tt.push(tag);
    }
    const created_at = mention.created_at + 1;
    let event = {
        id: "",
        kind: mention.kind,
        pubkey: pk,
        created_at: created_at, // Math.floor(Date.now() / 1000),
        tags: tt,
        content: message,
        sig: "",
    };
    event.id = getEventHash(event);
    event.sig = signEvent(event, sk);
    return event;
}

export function createNoteWithTags(
    nsec: string,
    mention: Event,
    message: string,
    tags: string[][],
): Event {
    const decoded = nip19.decode(nsec);
    const sk = decoded.data as string;
    const pk = getPublicKey(sk);
    const tt = [];
    if (mention.kind === 42) {
        for (let tag of mention.tags.filter((x: any[]) => x[0] === "e")) {
            tt.push(tag);
        }
    }
    for (let tag of tags) {
        tt.push(tag);
    }
    const created_at = mention.created_at + 1;
    let event = {
        id: "",
        kind: mention.kind,
        pubkey: pk,
        created_at: created_at, // Math.floor(Date.now() / 1000),
        tags: tt,
        content: message,
        sig: "",
    };
    event.id = getEventHash(event);
    event.sig = signEvent(event, sk);
    return event;
}

// 「～めう」という投稿に対して、各文字へ濁点(゛)を付けて返す文字列を作る。
// 末尾には「ー！！！！！」を足してから、1文字ずつ濁点を入れる。
export function meuify(content: string): string {
    return Array.from(content + "ー！！！！！")
        .map((c) => c + "゛")
        .join("");
}

// NIPs リポジトリの README の NIP 一覧 (- [NIP-01: ...](01.md)) から
// NIP 番号 → ページ名のマップを作る。キーは大文字に正規化する (例: "01", "7D")。
export function parseNipMap(readme: string): Map<string, string> {
    const nipMap = new Map<string, string>();
    for (
        const m of readme.matchAll(
            /^- \[NIP-([0-9A-Za-z]+)[^\]]*\]\(([0-9A-Za-z]+\.md)\)/gm,
        )
    ) {
        nipMap.set(m[1].toUpperCase(), m[2]);
    }
    return nipMap;
}

// NIPs リポジトリの README から Event Kinds テーブルを読み、kind → ページ名のマップを作る。
// 見出しとテーブルの間に説明文が入っても壊れないよう、次の見出しまでの行を走査する。
export function parseKindMap(readme: string): Map<number, string> {
    const kindMap = new Map<number, string>();
    const section = readme.split(/\n## Event Kinds/i)[1];
    if (!section) return kindMap;
    for (const line of section.split(/\n## /)[0].split(/\n/)) {
        const tok = line.split(/\|/);
        if (tok.length < 4) continue;
        const kind = tok[1].replace(/[` ]/g, "");
        // ヘッダ行("kind")や範囲行("1000-9999")は数字のみでないので除外
        if (!/^[0-9]+$/.test(kind)) continue;
        const page = tok[3].match(/\(([0-9A-Za-z]+\.md)\)/)?.[1];
        if (!page) continue;
        kindMap.set(Number(kind), page);
    }
    return kindMap;
}

export function levenshtein(a: string, b: string): number {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = new Array<number[]>(bn + 1);
    for (let i = 0; i <= bn; ++i) {
        let row = matrix[i] = new Array<number>(an + 1);
        row[0] = i;
    }
    const firstRow = matrix[0];
    for (let j = 1; j <= an; ++j) {
        firstRow[j] = j;
    }
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1],
                    matrix[i][j - 1],
                    matrix[i - 1][j],
                ) + 1;
            }
        }
    }
    return matrix[bn][an];
}

export function extractImageUrl(mention: Event): string {
    // 本文中の画像URL
    const m = mention.content.match(
        /https?:\/\/[^\s]+\.(?:jpe?g|png|webp|gif)(?:\?[^\s]*)?/i,
    );
    if (m) return m[0];
    // NIP-92 imeta タグ: ["imeta", "url https://...", "m image/png", ...]
    for (const tag of mention.tags) {
        if (tag[0] !== "imeta") continue;
        for (const kv of tag.slice(1)) {
            const mm = /^url\s+(\S+)/.exec(kv);
            if (mm) return mm[1];
        }
    }
    return "";
}

// 投稿が画像そのものではなく nostr:note1.../nostr:nevent1...（または q タグ）で
// 別の投稿を参照している場合の、参照先イベントID＋リレーヒントを取り出す。
export function findNostrRef(
    mention: Event,
): { id: string; relays: string[] } | null {
    const m = mention.content.match(
        /(?:nostr:)?(note1[0-9a-z]+|nevent1[0-9a-z]+)/i,
    );
    if (m) {
        try {
            const dec = nip19.decode(m[1]);
            if (dec.type === "note") return { id: dec.data as string, relays: [] };
            if (dec.type === "nevent") {
                const d = dec.data as { id: string; relays?: string[] };
                return { id: d.id, relays: d.relays ?? [] };
            }
        } catch (_e) { /* 不正な bech32 は無視 */ }
    }
    // 引用 q タグ: ["q", "<event-id>", "<relay>"]
    for (const tag of mention.tags) {
        if (tag[0] === "q" && tag[1]) {
            return { id: tag[1], relays: tag[2] ? [tag[2]] : [] };
        }
    }
    return null;
}

// 「一」〜「九十九」までの漢数字、または半角/全角の算用数字を数値にする。
export function parseJapaneseNumber(s: string): number | null {
    const half = s.replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    if (/^[0-9]+$/.test(half)) return Number(half);
    const digits: { [k: string]: number } = {
        "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
        "六": 6, "七": 7, "八": 8, "九": 9,
    };
    const m = s.match(/^([一二三四五六七八九]?)(十?)([一二三四五六七八九]?)$/);
    if (!m || s === "") return null;
    if (m[2] === "") {
        return m[1] !== "" && m[3] === "" ? digits[m[1]] : null;
    }
    return (m[1] ? digits[m[1]] : 1) * 10 + (m[3] ? digits[m[3]] : 0);
}

export type Zabuton =
    | { kind: "give"; target: string; count: number }
    | { kind: "takeAll"; target: string };

// 「山田君、npub1... 君に座布団3枚あげて」を解釈する。
// 相手は npub / nprofile (nostr: 付きも可) で指定し、hex pubkey にして返す。
export function parseZabuton(content: string): Zabuton | null {
    const head = "^山田(?:君|くん)[、,，\\s]*(?:nostr:)?((?:npub|nprofile)1[02-9ac-hj-np-z]+)\\s*(?:君|くん|さん|ちゃん)?";
    const give = content.trim().match(
        new RegExp(head + "に座布団\\s*([0-9０-９]+|[一二三四五六七八九十]+)\\s*枚\\s*(?:あげて|やって|あげなさい)[!！。]*$"),
    );
    const take = content.trim().match(
        new RegExp(head + "の座布団\\s*全部\\s*(?:持ってって|持っていって|取って|とって)[!！。]*$"),
    );
    const m = give || take;
    if (!m) return null;
    let target: string;
    try {
        const decoded = nip19.decode(m[1]);
        if (decoded.type === "npub") target = decoded.data as string;
        else if (decoded.type === "nprofile") {
            target = (decoded.data as nip19.ProfilePointer).pubkey;
        } else return null;
    } catch (_e) {
        return null;
    }
    if (take) return { kind: "takeAll", target };
    const count = parseJapaneseNumber(m[2]);
    if (count === null) return null;
    return { kind: "give", target, count };
}

// bolt11 invoice の金額を msat で返す。金額なし・不正な invoice は null。
// 相手の LNURL サーバーが指定額と違う invoice を返してきた時に弾くために使う。
export function bolt11AmountMsat(invoice: string): number | null {
    const lower = invoice.toLowerCase();
    const sep = lower.lastIndexOf("1");
    if (sep < 0) return null;
    const m = lower.slice(0, sep).match(/^ln(?:bc|tbs|tb|bcrt)([0-9]+)([munp]?)$/);
    if (!m) return null;
    const n = BigInt(m[1]);
    // 1 BTC = 100,000,000,000 msat
    const msat = ({
        "": n * 100_000_000_000n,
        "m": n * 100_000_000n,
        "u": n * 100_000n,
        "n": n * 100n,
        "p": n / 10n,
    } as { [k: string]: bigint })[m[2]];
    if (m[2] === "p" && n % 10n !== 0n) return null;
    if (msat > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(msat);
}

// nostr+walletconnect://<pubkey>?relay=...&secret=... を分解する。
// nostr-tools v1 の nip47.parseConnectionString は pathname を見ていて
// pubkey が取れないので自前で解釈する。
// 読めない時は error に「どこがおかしいか」を入れる。返信に出すので秘密の値は含めない。
export function parseNwcUrl(
    url: string,
):
    | { pubkey: string; relay: string; secret: string; error?: undefined }
    | { error: string } {
    // 古い nostrwalletconnect:// 形式や、引用符・空白付き、JSON からコピーして
    // & が \u0026 のままになった値も受け付ける
    const v = url.replace(/\s+/g, "").replace(/^["']|["']$/g, "")
        .replace(/\\u0026/gi, "&");
    if (v === "") return { error: "未設定" };
    const scheme = v.match(/^nostr\+?walletconnect:(?:\/\/)?/i);
    if (!scheme) return { error: `先頭が nostr+walletconnect:// ではありません (長さ ${v.length})` };
    const rest = v.slice(scheme[0].length);
    const q = rest.indexOf("?");
    if (q < 0) return { error: "? 以降のパラメータがありません" };
    const pubkey = rest.slice(0, q).replace(/\/$/, "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(pubkey)) {
        return { error: `pubkey が64桁の hex ではありません (長さ ${pubkey.length})` };
    }
    const params = new URLSearchParams(rest.slice(q + 1));
    const relay = params.get("relay");
    if (!relay) {
        return { error: `relay がありません (パラメータ: ${[...params.keys()].join(",")})` };
    }
    const secret = params.get("secret")?.toLowerCase();
    if (!secret) {
        return { error: `secret がありません (パラメータ: ${[...params.keys()].join(",")})` };
    }
    if (!/^[0-9a-f]{64}$/.test(secret)) {
        return { error: `secret が64桁の hex ではありません (長さ ${secret.length})` };
    }
    return { pubkey, relay, secret };
}
