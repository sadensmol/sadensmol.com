# sadensmol.com

Personal blog built with [Hugo](https://gohugo.io/) and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Local development

```sh
cp .env.sample .env   # fill in the values, see below
make up               # hugo server on http://localhost:1313
make add-post         # create a new post
```

`.env` is gitignored and loaded by `make`.

## Email subscriptions

Readers subscribe through a form at the end of each post and at the top of the Blog page. Subscribers are stored in [Buttondown](https://buttondown.com).

On every deploy, the workflow compares the live `/posts/index.json` with the new build. After the deploy succeeds, it emails each new post (title, description and a link) with `.github/scripts/notify-subscribers.sh`.

| Setting | Local (`.env`) | CI (GitHub → Settings → Secrets and variables → Actions) |
|---|---|---|
| Buttondown username (renders the form) | `HUGO_PARAMS_BUTTONDOWN_USERNAME` | variable `BUTTONDOWN_USERNAME` |
| Buttondown API key (sends emails) | `BUTTONDOWN_API_KEY` | secret `BUTTONDOWN_API_KEY` |

The form is hidden when the username is not set. The API key needs `email_access` and `sending_access` set to `write`.

To send an email by hand (it goes to **all** subscribers):

```sh
set -a; . ./.env; set +a
NEW_POSTS='[{"title":"…","url":"https://sadensmol.com/posts/…/","description":"…"}]' \
  bash .github/scripts/notify-subscribers.sh
```
