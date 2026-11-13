// 여백 독서노트 — 오프라인에서도 앱 화면이 열리도록 하는 서비스 워커
// 기록 데이터는 여기서 다루지 않습니다 (기록은 브라우저 IndexedDB에 따로 저장됨).
const SHELL = 'yeobaek-shell-v1';
const FONTS = 'yeobaek-fonts-v1';
const IMGS = 'yeobaek-covers-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== FONTS && k !== IMGS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 앱 화면: 인터넷이 되면 항상 최신판, 안 되면 저장해 둔 판
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 같은 주소의 아이콘·매니페스트: 저장본 우선
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // 책 검색으로 가져온 표지(카카오·오픈라이브러리): 한 번 보면 저장해 두고 오프라인에서도 표시
  if (req.destination === 'image' && /(^|\.)(kakaocdn\.net|daumcdn\.net|openlibrary\.org)$/.test(url.hostname)) {
    e.respondWith(caches.open(IMGS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // 글꼴(Google Fonts, Pretendard): 한 번 받으면 저장해 두고 오프라인에서도 사용
  if (/(^|\.)fonts\.googleapis\.com$|(^|\.)fonts\.gstatic\.com$|^cdn\.jsdelivr\.net$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
