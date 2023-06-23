'use strict'

import {
    nip19,
    getPublicKey,
    getEventHash,
    signEvent
} from 'nostr-tools'

const suddendeath = require('suddendeath')
export interface Env {
    NULLPOGA_GA_TOKEN: string
    NULLPOGA_VA_TOKEN: string
    NULLPOGA_LOGINBONUS_TOKEN: string
    NULLPOGA_NSEC: string
}

const page = `
<!doctype html>
<link href="//fonts.bunny.net/css?family=sigmar-one:400" rel="stylesheet" />
<meta charset="utf-8" />
<title>Cloudflare NullpoGa</title>
<style>
body {
  font-size: 40px;
  text-align: center;
}
h1,h2,h3 {
  font-family: 'Sigmar One', serif;
  font-style: normal;
  text-shadow: none;
  text-decoration: none;
  text-transform: none;
  letter-spacing: -0.05em;
  word-spacing: 0em;
  line-height: 1.15;
}
</style>
<body>
	<h1>ぬるぽ・ｶﾞｯ</h1>
	2023 (C) <a href="http://mattn.kaoriya.net/">mattn</a>, code is <a href="https://github.com/mattn/cloudflare-nostr-nullpoga">here</a>
</body>
`

function notAuthenticated(_request: Request, _env: Env) {
    return new Response(
        'Not Authenticated',
        {
            status: 401,
            headers: {
                'content-type': 'text/plain; charset=UTF-8',
                'accept-charset': 'utf-8',
            },
        },
    )
}

function notFound(_request: Request, _env: Env) {
    return new Response(`Not found`, {
        status: 404,
    })
}

function unsupportedMethod(_request: Request, _env: Env) {
    return new Response(`Unsupported method`, {
        status: 400,
    })
}

function bearerAuthentication(request: Request, secret: string) {
    if (!request.headers.has('authorization')) {
        return false
    }
    const authorization = request.headers.get('Authorization')!
    const [scheme, encoded] = authorization.split(' ')
    return scheme === 'Bearer' && encoded === secret
}

function createReplyWithTags(env: Env, mention: { [name: string]: any }, message: string, tags: string[][]): { [name: string]: any } {
    const decoded = nip19.decode(env.NULLPOGA_NSEC)
    const sk = decoded.data as string
    const pk = getPublicKey(sk)
    tags.push(['e', mention.id], ['p', mention.pubkey])
    let event = {
        id: '',
        kind: 1,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: message,
        sig: '',
    }
    event.id = getEventHash(event)
    event.sig = signEvent(event, sk)
    return event
}

function createEventWithTags(env: Env, message: string, tags: string[][]): { [name: string]: any } {
    const decoded = nip19.decode(env.NULLPOGA_NSEC)
    const sk = decoded.data as string
    const pk = getPublicKey(sk)
    let event = {
        id: '',
        kind: 1,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: message,
        sig: '',
    }
    event.id = getEventHash(event)
    event.sig = signEvent(event, sk)
    return event
}

async function doPage(_request: Request, _env: Env): Promise<Response> {
    return new Response(page, {
        headers: {
            'content-type': 'text/html; charset=UTF-8',
        },
    })
}

async function doNullpo(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_GA_TOKEN)) {
        return notAuthenticated(request, env)
    }
    return new Response(JSON.stringify(createEventWithTags(env, 'ぬるぽ', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doClock(_request: Request, env: Env): Promise<Response> {
    const now = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000))
    const hour = now.getHours()
    const message = 'ぬるぽが' + (hour < 12 ? '午前' : '午後') + (hour % 12) + '時をお伝えします'
    return new Response(JSON.stringify(createEventWithTags(env, message, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doSuitou(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'えらい！', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doIgyo(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    let tags = [['emoji', 'igyo', 'https://i.gyazo.com/6ca054b84392b4b1bd0038d305f72b64.png']]
    return new Response(JSON.stringify(createReplyWithTags(env, mention, ':igyo:', tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doLetterpack(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'https://i.gyazo.com/d3d5ab0007253e060482e52e5734d402.png', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doOnlyYou(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    let content = '' + mention.content
    content = content
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てる[?？!！.]*$/s, "$1てないのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でる[?？!！.]*$/s, "$1でないのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)いる[?？!！.]*$/s, "$1いないのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てない[?？!！.]*$/s, "$1てるのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でない[?？!！.]*$/s, "$1でるのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てへん[?？!！.]*$/s, "$1てんのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でへん[?？!！.]*$/s, "$1でんのお前だけ")
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doNullpoGa(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_GA_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: any } = await request.json()
    let content = '' + mention.content
    if (!content.match(/^ぬ[ぬるぽっー\n]+$/) || !content.match(/る/) || !content.match(/ぽ/)) {
        return new Response('')
    }
    content = content.replaceAll('ぬ', 'ｶﾞ').replaceAll('る', 'ｯ').replaceAll('ぽっ', 'ｶﾞｯ').replaceAll('ーぽ', 'ｰｶﾞｯ').replaceAll('ー', 'ｰ').replaceAll('っ', 'ｯ').replaceAll(/ｯ+/g, 'ｯ').replaceAll('ぽ', '')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doTsurupoVa(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_VA_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: any } = await request.json()
    let content = '' + mention.content
    if (!content.match(/^つ[つるぽっー\n]+$/) || !content.match(/る/) || !content.match(/ぽ/)) {
        return new Response('')
    }
    content = content.replaceAll('つ', 'ｳﾞｧ').replaceAll('る', 'ｯ').replaceAll('ぽっ', 'ｳﾞｧｯ').replaceAll('ーぽ', 'ｰｳﾞｧｯ').replaceAll('ー', 'ｰ').replaceAll('っ', 'ｯ').replaceAll(/ｯ+/g, 'ｯ').replaceAll('ぽ', '')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doNattoruyarogai(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    let content = '' + mention.content
    if (!content.match(/そうはならんやろ/)) {
        return new Response('')
    }
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'なっとるやろがい!!', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

const pai = "🀀🀁🀂🀃🀄🀅🀆🀇🀈🀉🀊🀋🀌🀍🀎🀏🀐🀑🀒🀓🀔🀕🀖🀗🀘🀙🀚🀛🀜🀝🀞🀟🀠🀡"
//const pai = "東南西北白発中一二三四五六七八九１２３４５６７８９①②③④⑤⑥⑦⑧⑨"

async function doMahjongPai(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const content = Array.from(pai.repeat(4))
        .map(v => ({ v, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort).map(({ v }) => v)
        .slice(0, 14).sort().join('')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
};

async function doSuddendeanth(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, suddendeath(mention.content, true), tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
};

async function doLoginbonus(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_LOGINBONUS_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'ありません', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doNagashite(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const m = mention.content.match(/流して(\s+.*)$/)
    const wave = m ? m[1].trim() : '🌊🌊🌊🌊🌊🌊🌊🌊'
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    return new Response(JSON.stringify(createEventWithTags(env, (wave + '\n').repeat(12), tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doLokuyow(request: Request, env: Env): Promise<Response> {
    const icons = [
        "hutu.png",
        "huhe.png",
        "nita.png",
        "maji.png",
        "bero.png",
        "basu.png",
        "kowa.png",
        "kowa2.png",
        "nita0.png",
        "ike2.png",
        "tiku.png",
        "tiku2.png",
        "note13kmrhvkpnqk3tkg4z4x7527aqejqg90vk8hwe38khmd9hn29lcwsr5qxaj.jpg",
        "note18aqm9p750934wyswmhfrdu93tnexrn6s62ser2fdlgs3xw7pc6csegutl2.jpg",
        "note1x4sau4fqg7yg5l639x3d9yahhczmhvzgg6sc9adzttc2uqer4faqvx5p7q.jpg",
        "note14x0c3vwz47ht4vnuvd0wxc5l8az2k09z4hx2hmw4zcgwz26nd9lsrr6f68.jpg",
        "note10z20nh6k3cawg6d2alqdytqct5rud897l0eplv930zkzpt4k6zqs96lr8q.jpg",
        "note1myxhqt5p3sc477h3fw7qfjgv37rx05cuj5yfj0y7u59yjszjjxgsczz76w.jpg",
    ]
    const item = "#ロクヨウ画像\n" + "https://raw.githubusercontent.com/Lokuyow/Lokuyow.github.io/main/icon/" + icons[Math.floor(Math.random() * icons.length)]
    const mention: { [name: string]: any } = await request.json()
    const tags = [['t', 'ロクヨウ画像']]
    return new Response(JSON.stringify(createReplyWithTags(env, mention, item, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

export default {
    async fetch(
        request: Request,
        env: Env): Promise<Response> {
        const { protocol, pathname } = new URL(request.url)

        if ('https:' !== protocol || 'https' !== request.headers.get('x-forwarded-proto')) {
            throw new Error('Please use a HTTPS connection.')
        }

        console.log(`${request.method}: ${request.url}`)

        if (request.method === 'GET') {
            switch (pathname) {
                case '/nullpo':
                    return doNullpo(request, env)
                case '/clock':
                    return doClock(request, env)
                case '/':
                    return doPage(request, env)
            }
            return notFound(request, env)
        }
        if (request.method === 'POST') {
            switch (pathname) {
                case '/loginbonus':
                    return doLoginbonus(request, env)
                case '/lokuyow':
                    return doLokuyow(request, env)
                case '/tsurupo':
                    return doTsurupoVa(request, env)
                case '/nagashite':
                    return doNagashite(request, env)
                case '/nattoruyarogai':
                    return doNattoruyarogai(request, env)
                case '/suddendeath':
                    return doSuddendeanth(request, env)
                case '/mahjongpai':
                    return doMahjongPai(request, env)
                case '/onlyyou':
                    return doOnlyYou(request, env)
                case '/suitou':
                    return doSuitou(request, env)
                case '/igyo':
                    return doIgyo(request, env)
                case '/letterpack':
                    return doLetterpack(request, env)
                case '/':
                    return doNullpoGa(request, env)
            }
            return notFound(request, env)
        }

        return unsupportedMethod(request, env)
    },
}
