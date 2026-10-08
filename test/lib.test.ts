import { test } from "node:test";
import assert from "node:assert/strict";
import type { Event } from "nostr-tools";
import { getPublicKey, nip19, verifySignature } from "nostr-tools";

import {
    bearerAuthentication,
    bolt11AmountMsat,
    createLike,
    createNoteWithTags,
    createReplyWithTags,
    extractImageUrl,
    findNostrRef,
    levenshtein,
    meuify,
    parseBlockedPubkeys,
    parseKindMap,
    parseJapaneseNumber,
    parseNipMap,
    parseNwcUrl,
    parseZabuton,
} from "../src/lib.ts";

// テスト用の固定鍵ペア
const NSEC =
    "nsec1d8lqxmd88kclv5t4ns0zpcrkjr5qgxtmaqr2e3wqngdd25r3um7qm7aemf";
const SK = nip19.decode(NSEC).data as string;
const PK = getPublicKey(SK);
const NPUB = nip19.npubEncode(PK);

// 別人(投稿者)を表すダミー pubkey
const OTHER_PK =
    "0000000000000000000000000000000000000000000000000000000000000001";

function mention(overrides: Partial<Event> = {}): Event {
    return {
        id: "abc123",
        kind: 1,
        pubkey: OTHER_PK,
        created_at: 1684329382,
        tags: [],
        content: "",
        sig: "",
        ...overrides,
    } as Event;
}

test("levenshtein: 同一文字列は 0", () => {
    assert.equal(levenshtein("kitten", "kitten"), 0);
});

test("levenshtein: 古典的な例", () => {
    assert.equal(levenshtein("kitten", "sitting"), 3);
});

test("levenshtein: 空文字は相手の長さ", () => {
    assert.equal(levenshtein("", "abc"), 3);
    assert.equal(levenshtein("abc", ""), 3);
});

test("levenshtein: マルチバイト(コードユニット単位)", () => {
    assert.equal(levenshtein("ねこ", "いぬ"), 2);
});

test("parseBlockedPubkeys: npub は hex に変換される", () => {
    const set = parseBlockedPubkeys({ NULLPOGA_BLOCKED_PUBKEYS: NPUB });
    assert.ok(set.has(PK));
});

test("parseBlockedPubkeys: hex はそのまま入る", () => {
    const set = parseBlockedPubkeys({ NULLPOGA_BLOCKED_PUBKEYS: OTHER_PK });
    assert.ok(set.has(OTHER_PK));
});

test("parseBlockedPubkeys: カンマ・空白区切りを両方扱う", () => {
    const set = parseBlockedPubkeys({
        NULLPOGA_BLOCKED_PUBKEYS: `${OTHER_PK}, ${NPUB}`,
    });
    assert.equal(set.size, 2);
    assert.ok(set.has(OTHER_PK));
    assert.ok(set.has(PK));
});

test("parseBlockedPubkeys: 未設定なら空集合", () => {
    assert.equal(parseBlockedPubkeys({}).size, 0);
    assert.equal(parseBlockedPubkeys({ NULLPOGA_BLOCKED_PUBKEYS: "" }).size, 0);
});

test("parseBlockedPubkeys: 不正な npub は無視する", () => {
    const set = parseBlockedPubkeys({
        NULLPOGA_BLOCKED_PUBKEYS: `npub1invalid, ${OTHER_PK}`,
    });
    assert.equal(set.size, 1);
    assert.ok(set.has(OTHER_PK));
});

function req(headers: Record<string, string>): Request {
    return new Request("https://example.com/", { headers });
}

test("bearerAuthentication: 正しいトークンで true", () => {
    assert.equal(
        bearerAuthentication(req({ Authorization: "Bearer secret" }), "secret"),
        true,
    );
});

test("bearerAuthentication: 誤ったトークンで false", () => {
    assert.equal(
        bearerAuthentication(req({ Authorization: "Bearer wrong" }), "secret"),
        false,
    );
});

test("bearerAuthentication: スキームが Bearer でなければ false", () => {
    assert.equal(
        bearerAuthentication(req({ Authorization: "Basic secret" }), "secret"),
        false,
    );
});

test("bearerAuthentication: ヘッダー無しなら false", () => {
    assert.equal(bearerAuthentication(req({}), "secret"), false);
});

test("createLike: kind 7 で署名済み、e タグを持つ", () => {
    const ev = createLike(NSEC, mention({ id: "deadbeef" }));
    assert.equal(ev.kind, 7);
    assert.equal(ev.content, "🩷");
    assert.equal(ev.pubkey, PK);
    assert.deepEqual(ev.tags, [["e", "deadbeef"]]);
    assert.equal(ev.created_at, 1684329383);
    assert.ok(verifySignature(ev));
});

test("createReplyWithTags: e/p タグを付け署名する", () => {
    const ev = createReplyWithTags(NSEC, mention({ id: "x1" }), "hello", []);
    assert.equal(ev.content, "hello");
    assert.equal(ev.kind, 1);
    assert.deepEqual(ev.tags[0], ["e", "x1"]);
    assert.deepEqual(ev.tags[1], ["p", OTHER_PK]);
    assert.ok(verifySignature(ev));
});

test("createReplyWithTags: notice=false なら p タグを付けない", () => {
    const ev = createReplyWithTags(NSEC, mention({ id: "x1" }), "hi", [], false);
    assert.deepEqual(ev.tags, [["e", "x1"]]);
});

test("createReplyWithTags: kind 42 は元の e タグを引き継ぐ", () => {
    const ev = createReplyWithTags(
        NSEC,
        mention({ kind: 42, id: "x1", tags: [["e", "root"], ["p", "ignore"]] }),
        "hi",
        [["t", "extra"]],
    );
    assert.deepEqual(ev.tags, [
        ["e", "x1"],
        ["p", OTHER_PK],
        ["e", "root"],
        ["t", "extra"],
    ]);
});

test("createReplyWithTags: 自分自身への返信は拒否", () => {
    assert.throws(
        () => createReplyWithTags(NSEC, mention({ pubkey: PK }), "hi", []),
        /Self reply not acceptable/,
    );
});

test("createNoteWithTags: e/p タグを付けず署名する", () => {
    const ev = createNoteWithTags(NSEC, mention({ id: "x1" }), "note", []);
    assert.equal(ev.content, "note");
    assert.deepEqual(ev.tags, []);
    assert.ok(verifySignature(ev));
});

test("meuify: 各文字に濁点を付け末尾に伸ばし棒と感嘆符を足す", () => {
    assert.equal(
        meuify("めうのお尻にＮＩＰ－０１が入ってくるめう"),
        "め゛う゛の゛お゛尻゛に゛Ｎ゛Ｉ゛Ｐ゛－゛０゛１゛が゛入゛っ゛て゛く゛る゛め゛う゛ー゛！゛！゛！゛！゛！゛",
    );
});

test("extractImageUrl: 本文中の画像URLを取り出す", () => {
    assert.equal(
        extractImageUrl(mention({ content: "見て https://example.com/a.PNG?x=1 ね" })),
        "https://example.com/a.PNG?x=1",
    );
});

test("extractImageUrl: imeta タグから取り出す", () => {
    assert.equal(
        extractImageUrl(
            mention({
                tags: [["imeta", "url https://example.com/b.jpg", "m image/jpeg"]],
            }),
        ),
        "https://example.com/b.jpg",
    );
});

test("extractImageUrl: 無ければ空文字", () => {
    assert.equal(extractImageUrl(mention({ content: "ただのテキスト" })), "");
});

test("findNostrRef: note1 参照を解決する", () => {
    const id = "00".repeat(32);
    const note = nip19.noteEncode(id);
    const ref = findNostrRef(mention({ content: `これ nostr:${note}` }));
    assert.deepEqual(ref, { id, relays: [] });
});

test("findNostrRef: q タグから参照を取り出す", () => {
    const ref = findNostrRef(
        mention({ tags: [["q", "eventid", "wss://relay.example"]] }),
    );
    assert.deepEqual(ref, { id: "eventid", relays: ["wss://relay.example"] });
});

test("findNostrRef: 参照が無ければ null", () => {
    assert.equal(findNostrRef(mention({ content: "なし" })), null);
});

// 実際の README と同じ構造の抜粋。
// 見出しとテーブルの間に説明文の段落があるのがポイント。
const README = `# NIPs

- [NIP-01: Basic protocol flow description](01.md)
- [NIP-23: Long-form Content](23.md)
- [NIP-C7: Chats](C7.md)

## Event Kinds

This table is not exhaustive. For a machine-readable registry prefer the registry-of-kinds.

| kind          | description                     | NIP                                    |
| ------------- | ------------------------------- | -------------------------------------- |
| \`0\`           | User Metadata                   | [01](01.md)                            |
| \`9\`           | Chat Message                    | [C7](C7.md)                            |
| \`30023\`       | Long-form Content               | [23](23.md)                            |

## Message types
`;

test("parseKindMap: 見出し直後に説明文があってもテーブルを読める", () => {
    const map = parseKindMap(README);
    assert.equal(map.get(0), "01.md");
    assert.equal(map.get(30023), "23.md");
});

test("parseKindMap: 16進ページ名の NIP も読める", () => {
    assert.equal(parseKindMap(README).get(9), "C7.md");
});

test("parseKindMap: 見出しが無ければ空マップ", () => {
    assert.equal(parseKindMap("# NIPs\nなにもない").size, 0);
});

test("parseNipMap: NIP 一覧からページ名を引ける", () => {
    const map = parseNipMap(README);
    assert.equal(map.get("01"), "01.md");
    assert.equal(map.get("23"), "23.md");
    assert.equal(map.get("C7"), "C7.md");
    assert.equal(map.get("99"), undefined);
});

test("parseJapaneseNumber: 算用数字と漢数字", () => {
    assert.equal(parseJapaneseNumber("3"), 3);
    assert.equal(parseJapaneseNumber("１０"), 10);
    assert.equal(parseJapaneseNumber("三"), 3);
    assert.equal(parseJapaneseNumber("十"), 10);
    assert.equal(parseJapaneseNumber("十二"), 12);
    assert.equal(parseJapaneseNumber("二十"), 20);
    assert.equal(parseJapaneseNumber("九十九"), 99);
    assert.equal(parseJapaneseNumber(""), null);
    assert.equal(parseJapaneseNumber("三三"), null);
    assert.equal(parseJapaneseNumber("十十"), null);
    assert.equal(parseJapaneseNumber("百"), null);
});

const ZABUTON_NPUB =
    "npub1937vv2nf06360qn9y8el6d8sevnndy7tuh5nzre4gj05xc32tnwqauhaj6";
const ZABUTON_HEX =
    "2c7cc62a697ea3a7826521f3fd34f0cb273693cbe5e9310f35449f43622a5cdc";

test("parseZabuton: 座布団をあげる", () => {
    assert.deepEqual(
        parseZabuton(`山田君、${ZABUTON_NPUB} 君に座布団3枚あげて`),
        { kind: "give", target: ZABUTON_HEX, count: 3 },
    );
    assert.deepEqual(
        parseZabuton(`山田くん nostr:${ZABUTON_NPUB}に座布団 三 枚やって！`),
        { kind: "give", target: ZABUTON_HEX, count: 3 },
    );
    const nprofile = nip19.nprofileEncode({ pubkey: ZABUTON_HEX });
    assert.deepEqual(
        parseZabuton(`山田君、${nprofile} さんに座布団１０枚あげて`),
        { kind: "give", target: ZABUTON_HEX, count: 10 },
    );
});

test("parseZabuton: 座布団全部持ってって", () => {
    assert.deepEqual(
        parseZabuton(`山田君、${ZABUTON_NPUB} 君の座布団全部持ってって`),
        { kind: "takeAll", target: ZABUTON_HEX },
    );
});

test("parseZabuton: 該当しない・不正な入力", () => {
    assert.equal(parseZabuton("座布団3枚あげて"), null);
    assert.equal(parseZabuton(`${ZABUTON_NPUB} 君に座布団3枚あげて`), null);
    assert.equal(parseZabuton("山田君、npub1abc 君に座布団3枚あげて"), null);
    // 前後に余計な文があるものは受け付けない
    assert.equal(
        parseZabuton(`山田君、${ZABUTON_NPUB} 君に座布団3枚あげて、と言ったら`),
        null,
    );
    const note = nip19.noteEncode(ZABUTON_HEX);
    assert.equal(parseZabuton(`山田君、${note} 君に座布団3枚あげて`), null);
});

test("bolt11AmountMsat: 金額を msat で返す", () => {
    assert.equal(bolt11AmountMsat("lnbc30n1pjqqqqq"), 3000);
    assert.equal(bolt11AmountMsat("lnbc10u1pjqqqqq"), 1_000_000);
    assert.equal(bolt11AmountMsat("lnbc1m1pjqqqqq"), 100_000_000);
    assert.equal(bolt11AmountMsat("lnbc1500p1pjqqqqq"), 150);
    assert.equal(bolt11AmountMsat("LNBC30N1PJQQQQQ"), 3000);
    assert.equal(bolt11AmountMsat("lntbs30n1pjqqqqq"), 3000);
    // 金額なし・sub-msat・不正
    assert.equal(bolt11AmountMsat("lnbc1pjqqqqq"), null);
    assert.equal(bolt11AmountMsat("lnbc15p1pjqqqqq"), null);
    assert.equal(bolt11AmountMsat("hello"), null);
});

test("parseNwcUrl: NWC の接続文字列を分解する", () => {
    const secret = "11".repeat(32);
    const url = `nostr+walletconnect://${ZABUTON_HEX}?relay=wss%3A%2F%2Frelay.example.com&secret=${secret}`;
    assert.deepEqual(parseNwcUrl(url), {
        pubkey: ZABUTON_HEX,
        relay: "wss://relay.example.com",
        secret,
    });
    // Alby の古い形式、複数 relay、lud16 付き、引用符付き
    assert.deepEqual(
        parseNwcUrl(`"nostrwalletconnect://${ZABUTON_HEX}?relay=wss://relay.getalby.com/v1&relay=wss://r2&secret=${secret}&lud16=a@getalby.com"`),
        { pubkey: ZABUTON_HEX, relay: "wss://relay.getalby.com/v1", secret },
    );
    // JSON からコピーして & が \u0026 のまま
    assert.deepEqual(
        parseNwcUrl(`nostr+walletconnect://${ZABUTON_HEX}?relay=wss://relay.getalby.com/v1\\u0026secret=${secret}\\u0026lud16=a@getalby.com`),
        { pubkey: ZABUTON_HEX, relay: "wss://relay.getalby.com/v1", secret },
    );
    const err = (u: string) => (parseNwcUrl(u) as { error: string }).error;
    assert.match(err(`nostr+walletconnect://${ZABUTON_HEX}?relay=wss://r`), /secret がありません \(パラメータ: relay\)/);
    assert.match(err(`nostr+walletconnect://${ZABUTON_HEX}?relay=wss://r&secret=abc`), /secret が64桁の hex ではありません \(長さ 3\)/);
    assert.match(err(`nostr+walletconnect://abc?relay=wss://r&secret=${secret}`), /pubkey が64桁/);
    assert.match(err(`nostr+walletconnect://${ZABUTON_HEX}?secret=${secret}`), /relay がありません/);
    assert.match(err("https://example.com"), /先頭が/);
    assert.equal(err(""), "未設定");
    // 秘密の値はエラーに含めない
    assert.ok(!err(`nostr+walletconnect://${ZABUTON_HEX}?relay=wss://r&secret=${secret}x`).includes(secret));
});
