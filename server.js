const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');
require('dotenv').config();

const app = express();
const port = 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const stateKey = 'spotify_auth_state';

// 静的ファイルの提供
app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.get('/login', (req, res) => {
    const state = generateRandomString(16);
    res.cookie(stateKey, state);

    const scope = 'user-top-read';
    const queryParams = querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
        state: state
    });

    res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

app.get('/callback', (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' + querystring.stringify({ error: 'state_mismatch' }));
    } else {
        res.clearCookie(stateKey);
        const authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
            },
            json: true
        };

        axios.post(authOptions.url, querystring.stringify(authOptions.form), { headers: authOptions.headers })
            .then(response => {
                const access_token = response.data.access_token;
                res.redirect('/#' + querystring.stringify({ access_token: access_token }));
            })
            .catch(error => {
                res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
            });
    }
});

app.get('/top-tracks', (req, res) => {
    const access_token = req.query.access_token;
    const time_range = req.query.time_range || 'medium_term'; // 'short_term', 'medium_term', 'long_term'

    axios.get('https://api.spotify.com/v1/me/top/tracks', {
        headers: { 'Authorization': 'Bearer ' + access_token },
        params: { time_range: time_range }
    }).then(response => {
        res.json(response.data);
    }).catch(error => {
        res.status(error.response.status).send(error.response.data);
    });
});

const generateRandomString = length => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
