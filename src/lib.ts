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
