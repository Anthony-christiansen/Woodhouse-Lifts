// Applies the saved theme before first paint (no dark→light flash). Settings → Appearance writes wl_theme.
// Loaded as a plain (blocking) script from index.html; kept out of the page so the Content-Security-Policy needs no inline scripts.
try {
  var t = localStorage.getItem('wl_theme');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  var light = t === 'light' || (t !== 'dark' && matchMedia('(prefers-color-scheme: light)').matches);
  if (light) document.querySelector('meta[name="theme-color"]').setAttribute('content', '#f3f4f6');
} catch (e) { /* storage blocked: system theme applies */ }
