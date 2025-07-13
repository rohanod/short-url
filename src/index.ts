// src/index.ts
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';

const app = new Hono<{ Bindings: Env }>();

// ---
// UI
// ---
const UI = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URL Shortener</title>
    <style>
        body { font-family: sans-serif; container-type: inline-size; }
        h1 { text-align: center; }
        form { display: flex; gap: 0.5em; }
        li {
            display: grid;
            grid-template-columns: 1fr auto auto;
            gap: 1em;
            align-items: center;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1em;
        }
        .card {
            list-style-type: none;
            padding: 1em;
            border-radius: 1em;
            border: 1px solid;
        }
        .delete {
          background-color: #ff5252;
          color: white;
        }
        .copy {
          background-color: #4caf50;
          color: white;
        }
        .delete, .copy {
          border: none;
          padding: 0.5em 1em;
          border-radius: 0.5em;
          cursor: pointer;
        }
    </style>
</head>
<body>
    <h1>URL Shortener</h1>
    <form>
        <input type="text" name="key" placeholder="Short name" required>
        <input type="url" name="url" placeholder="URL" required>
        <button type="submit">Create</button>
    </form>
    <ul id="redirects"></ul>

    <script>
        const form = document.querySelector('form');
        const redirects = document.querySelector('#redirects');

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const key = formData.get('key');
            const url = formData.get('url');
            await fetch('/admin/api/redirects/' + key, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            form.reset();
            await loadRedirects();
        });

        async function loadRedirects() {
            const response = await fetch('/admin/api/redirects');
            const data = await response.json();
            redirects.innerHTML = '';
            for (const key in data) {
                const li = document.createElement('li');
                li.innerHTML = 
                    '<a href="' + data[key] + '">' + key + '</a>' +
                    '<button class="copy" data-url="' + window.location.origin + '/' + key + '">Copy</button>' +
                    '<button class="delete" data-key="' + key + '">Delete</button>';
                redirects.appendChild(li);
            }
        }

        redirects.addEventListener('click', async (event) => {
            if (event.target.classList.contains('delete')) {
                const key = event.target.dataset.key;
                await fetch('/admin/api/redirects/' + key, { method: 'DELETE' });
                await loadRedirects();
            }
            if (event.target.classList.contains('copy')) {
                const url = event.target.dataset.url;
                navigator.clipboard.writeText(url);
                alert('Copied to clipboard!');
            }
        });

        loadRedirects();
    </script>
</body>
</html>
`;

// ---
// Admin
// ---
const admin = new Hono<{ Bindings: Env }>();

admin.use(
  '/*',
  basicAuth({
    username: (c) => c.env.ADMIN_USERNAME,
    password: (c) => c.env.ADMIN_PASSWORD,
  })
);

admin.get('/', (c) => c.html(UI));

// ---
// API
// ---
const api = new Hono<{ Bindings: Env }>();

api.get('/redirects', async (c) => {
  const { keys } = await c.env.redirects.list();
  const redirects = await Promise.all(
    keys.map(async ({ name }) => {
      const url = await c.env.redirects.get(name);
      return { [name]: url };
    })
  );
  return c.json(Object.assign({}, ...redirects));
});

api.put('/redirects/:key', async (c) => {
  const { key } = c.req.param();
  const { url } = await c.req.json<{ url: string }>();
  await c.env.redirects.put(key, url);
  return c.json({ success: true });
});

api.delete('/redirects/:key', async (c) => {
  const { key } = c.req.param();
  await c.env.redirects.delete(key);
  return c.json({ success: true });
});

admin.route('/api', api);
app.route('/admin', admin);

// ---
// Redirect
app.get('/:shortname', async (c) => {
  const { shortname } = c.req.param();
  const url = await c.env.redirects.get(shortname);
  if (url) {
    return c.redirect(url, 302);
  }
  return c.notFound();
});

app.get('/', (c) => c.redirect('https://tpg.rohanodwyer.com', 301));

export default app;