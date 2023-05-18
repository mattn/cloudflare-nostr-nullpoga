'use strict'

import {
    nip19,
    getPublicKey,
    getEventHash,
    signEvent
} from 'nostr-tools'

export interface Env {
    NULLPOGA_GA_TOKEN: string
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

function createReply(env: Env, mention: { [name: string]: string }, message: string): object {
    const decoded = nip19.decode(env.NULLPOGA_NSEC)
    const sk = decoded.data as string
    const pk = getPublicKey(sk)
    let event = {
        id: '',
        kind: 1,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', mention.id], ['p', mention.pubkey]],
        content: message,
        sig: '',
    }
    event.id = getEventHash(event)
    event.sig = signEvent(event, sk)
    return event
}

function createEvent(env: Env, message: string): object {
    const decoded = nip19.decode(env.NULLPOGA_NSEC)
    const sk = decoded.data as string
    const pk = getPublicKey(sk)
    let event = {
        id: '',
        kind: 1,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
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
    return new Response(JSON.stringify(createEvent(env, 'ぬるぽ')), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doClock(request: Request, env: Env): Promise<Response> {
    const now = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000))
    const hour = now.getHours()
    const message = 'ぬるぽが' + (hour < 12 ? '午前' : '午後') + (hour % 12) + '時をお伝えします'
    return new Response(JSON.stringify(createEvent(env, message)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doGa(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_GA_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: string } = await request.json()
    let content = '' + mention.content
    if (!content.match(/^ぬ[ぬるぽっー]+$/) || !content.match(/[るぽ]/)) {
        return new Response('')
    }
    content = content.replaceAll('ぬ', 'ｶﾞ').replaceAll('る', 'ｯ').replaceAll('ぽっ', 'ｶﾞｯ').replaceAll('ーぽ', 'ｰｶﾞｯ').replaceAll('ー', 'ｰ').replaceAll('っ', 'ｯ').replaceAll(/ｯ+/g, 'ｯ').replaceAll('ぽ', '')
    return new Response(JSON.stringify(createReply(env, mention, content)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doLoginbonus(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_LOGINBONUS_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: string } = await request.json()
    return new Response(JSON.stringify(createReply(env, mention, 'ありません')), {
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
    const item = "https://raw.githubusercontent.com/Lokuyow/Lokuyow.github.io/main/icon/" + icons[Math.floor(Math.random() * icons.length)]
    const mention: { [name: string]: string } = await request.json()
    return new Response(JSON.stringify(createReply(env, mention, item)), {
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
                case '/':
                    return doGa(request, env)
            }
            return notFound(request, env)
        }

        return unsupportedMethod(request, env)
    },
}
