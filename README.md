# Game — action survivor online (low poly)

A **tela** (PC/TV) roda o jogo. Os **celulares** viram controle: entram numa sala com código de 4 letras.

## Rodar (mesma rede Wi‑Fi)
```bash
npm install
npm run server      # terminal 1: relay (porta 8080)
npm run dev         # terminal 2: jogo (porta 5173)
```
Abra no PC `http://IP-DO-SEU-PC:5173` (não `localhost`, senão o QR code aponta pro lugar errado).
No celular: escaneie o QR code ou abra `/controller.html` e digite o código.
Teste sem celular: WASD + mouse (clique atira), 1 pistola, 2 carabina, R recarrega.

## Controles do celular
Stick esquerdo = mover · stick direito = mirar (atira enquanto inclinado) · botões: trocar arma / recarregar.

## Online de verdade (fora do Wi‑Fi)
1. Hospede `server/server.js` (Render, Fly.io, Railway…). Ele usa a variável `PORT`.
2. Hospede o front (`npm run build` → pasta `dist`) em Vercel/Netlify/Cloudflare Pages.
3. Defina `VITE_WS_URL=wss://seu-servidor.exemplo.com` antes do build.
