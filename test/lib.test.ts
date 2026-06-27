import { test } from "node:test";
import assert from "node:assert/strict";
import type { Event } from "nostr-tools";
import { getPublicKey, nip19, verifySignature } from "nostr-tools";

import {
    bearerAuthentication,
    createLike,
    createNoteWithTags,
    createReplyWithTags,
    extractImageUrl,
    findNostrRef,
    levenshtein,
    parseBlockedPubkeys,
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
