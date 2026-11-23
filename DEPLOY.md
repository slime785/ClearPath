# Deploying ClearPath to bender

Live site: https://bender.cs.csubak.edu/clearpath-26/
API (through NGINX): https://bender.cs.csubak.edu/clearpath-26/api/


## How it is laid out on bender

- NGINX serves the website files (the `public/` folder) from `/var/www/clearpath-26`.
- NGINX forwards `/clearpath-26/api/` to the Node server on port 27017. It removes the
  `/clearpath-26/api/` part first, so the server answers both `/api/...` and `/...`.
- The Node server lives in `~/clearpath-server` (NOT under /var/www, because that folder is public).
- `~/clearpath-server/firebase-key.json` is the service account key. It exists only on bender and
  on the developers' computers. Never commit it and never put it in /var/www.
- NGINX does not pass WebSocket headers, so on bender the chat uses Socket.io polling only.
  The client picks this automatically when the page is under `/clearpath-26/`.

## Log in (two hops)

```
ssh YOURUSERNAME@odin.cs.csubak.edu
ssh clearpath-26@bender.cs.csubak.edu
```

## Redeploy after a change

1. On your own computer, in the project folder, copy the code up:

```
scp -r -J YOURUSERNAME@odin.cs.csubak.edu server.js firebase.js package.json package-lock.json public clearpath-26@bender.cs.csubak.edu:~/clearpath-server/
```

2. On bender, copy the website files to where NGINX serves them:

```
cp -r ~/clearpath-server/public/. /var/www/clearpath-26/
```

3. If package.json changed, install packages:

```
cd ~/clearpath-server
npm install --omit=dev
```

4. Restart the server:

```
cd ~/clearpath-server
kill $(cat server.pid)
PORT=27017 nohup node server.js > server.log 2>&1 &
echo $! > server.pid
```

5. Check it:

```
tail -3 ~/clearpath-server/server.log
curl -s http://127.0.0.1:27017/health
```

From any computer: `curl https://bender.cs.csubak.edu/clearpath-26/api/health` should print `{"status":"ok"}`.

## Stop the server

```
kill $(cat ~/clearpath-server/server.pid)
```