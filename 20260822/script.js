/* ==================================================================
   하루펫택시 — 인터랙션
   외부 라이브러리 없음 · 백엔드 없음 · 순수 자바스크립트
   ================================================================== */

(function () {
    'use strict';

    var mqMobile = window.matchMedia('(max-width: 900px)');
    var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    function $(id) { return document.getElementById(id); }
    function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function won(n) { return n.toLocaleString('ko-KR'); }

    /* ================================================================
       1. 트윈 트랙 스크롤 엔진
          좌측 트랙은 위로, 우측 트랙은 아래로 움직입니다.
       ================================================================ */

    var panels = all('.panel');
    var BLOCKS = panels.reduce(function (m, p) {
        return Math.max(m, parseInt(p.getAttribute('data-i'), 10) + 1);
    }, 1);

    var LABELS = ['하루펫 소개', '서비스 안내', '고객 후기', '요금 안내', '예약 문의'];

    function syncViewport() {
        vh = window.innerHeight;
        maxScroll = (BLOCKS - 1) * vh;
        document.documentElement.style.setProperty('--app-vh', vh + 'px');
    }

    var vh = window.innerHeight;
    var maxScroll = (BLOCKS - 1) * vh;
    var target = 0;
    var current = 0;
    var engineOn = false;
    var activeBlock = -1;

    var frameNum = $('frame-num');
    var frameLabel = $('frame-label');
    var frameHint = $('frame-hint');
    var roadPaw = $('road-paw');
    var navUp = $('nav-up');
    var navDown = $('nav-down');
    var hintGone = false;

    function dismissHint() {
        if (hintGone || !frameHint) { return; }
        hintGone = true;
        frameHint.classList.add('is-gone');
    }

    function revealBlock(i) {
        panels.forEach(function (p) {
            if (parseInt(p.getAttribute('data-i'), 10) !== i) { return; }
            all('.reveal', p).forEach(function (el) { el.classList.add('is-on'); });
        });
    }

    function applyTransforms() {
        for (var i = 0; i < panels.length; i++) {
            var p = panels[i];
            var idx = parseInt(p.getAttribute('data-i'), 10);
            var y = p.classList.contains('t-left') ? idx * vh - current : current - idx * vh;
            p.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
        }
    }

    function updateFrame(ratio) {
        var r = clamp(ratio, 0, 1);
        if (roadPaw) { roadPaw.style.top = (4 + r * 92).toFixed(2) + '%'; }

        var blk = clamp(Math.round(r * (BLOCKS - 1)), 0, BLOCKS - 1);
        if (blk !== activeBlock) {
            activeBlock = blk;
            if (frameNum) { frameNum.textContent = pad2(blk + 1); }
            if (frameLabel) { frameLabel.textContent = LABELS[blk] || ''; }
            revealBlock(blk);
            revealBlock(blk + 1);
        }
        if (navUp) { navUp.disabled = target < vh * 0.5; }
        if (navDown) { navDown.disabled = target > maxScroll - vh * 0.5; }
    }

    /* 전환은 시간 기반이라 언제 끝나는지 정확히 알 수 있습니다. */
    var ANIM_MS = 380;
    var animFrom = 0;
    var animStart = 0;
    var animating = false;

    function nowMs() { return new Date().getTime(); }

    function startAnim() {
        if (mqReduce.matches) { current = target; animating = false; return; }
        animFrom = current;
        animStart = nowMs();
        animating = true;
    }

    function loop() {
        if (!engineOn) { return; }
        if (animating) {
            var t = (nowMs() - animStart) / ANIM_MS;
            if (t >= 1) { t = 1; animating = false; }
            var k = 1 - Math.pow(1 - t, 3);      /* 끝에서 부드럽게 멈춤 */
            current = animFrom + (target - animFrom) * k;
        } else {
            current = target;
        }
        applyTransforms();
        updateFrame(maxScroll > 0 ? current / maxScroll : 0);
        window.requestAnimationFrame(loop);
    }

    function startEngine() {
        if (engineOn) { return; }
        engineOn = true;
        syncViewport();
        window.requestAnimationFrame(loop);
    }

    function stopEngine() {
        engineOn = false;
        panels.forEach(function (p) { p.style.transform = ''; });
    }

    function goTo(i) {
        dismissHint();
        if (engineOn) {
            var next = clamp(i * vh, 0, maxScroll);
            if (next !== target) { target = next; startAnim(); }
        } else {
            var el = document.getElementById('block-' + i);
            if (el) { el.scrollIntoView({ behavior: mqReduce.matches ? 'auto' : 'smooth', block: 'start' }); }
        }
    }

    /* 패널 안쪽이 아직 스크롤될 여지가 있으면 그쪽에 스크롤을 양보합니다. */
    function innerCanScroll(node, dir) {
        while (node && node !== document.body) {
            if (node.classList && node.classList.contains('panel-inner')) {
                var room = node.scrollHeight - node.clientHeight;
                if (room > 40) {   /* 몇 px 남짓한 넘침은 무시하고 구간을 넘깁니다 */
                    if (dir > 0 && node.scrollTop < room - 2) { return true; }
                    if (dir < 0 && node.scrollTop > 2) { return true; }
                }
                return false;
            }
            node = node.parentNode;
        }
        return false;
    }

    /* 현재 머물러 있는 구간 번호 */
    function sectionIndex() {
        return clamp(Math.round(target / vh), 0, BLOCKS - 1);
    }

    /* 한 칸씩만 움직입니다. 중간에 걸치는 위치는 만들지 않습니다. */
    function step(dir) {
        goTo(clamp(sectionIndex() + dir, 0, BLOCKS - 1));
    }

    /* 트랙패드는 한 번 밀면 관성으로 이벤트가 1~2초 동안 쏟아집니다.
       이벤트가 끊길 때까지를 '한 동작'으로 보고 한 구간만 움직입니다. */
    /* 관성은 한 번 튄 뒤로는 계속 약해지기만 합니다.
       그래서 "마지막 이동 이후 가장 셌던 세기"보다 더 세게 밀렸을 때만
       한 칸 움직입니다. 기준값은 시간이 지나면 스스로 낮아지므로,
       살짝만 다시 밀어도 곧바로 반응합니다. */
    var peakSince = 0;          /* 마지막 이동 이후 최대 세기 (시간에 따라 감쇠) */
    var lastEventAt = 0;
    var lastStepAt = 0;
    var idleTimer = null;
    var IDLE_END = 90;          /* 이벤트가 멎으면 기준값을 지웁니다 */
    var MIN_GAP = 130;          /* 한 동작이 여러 칸 넘기지 않게 하는 최소 간격 */
    var DECAY = 0.998;          /* 기준값이 1ms 마다 낮아지는 비율 */

    function resetGesture() {
        peakSince = 0;
        lastEventAt = 0;
    }

    function snapStep(dir, abs) {
        var now = nowMs();

        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(resetGesture, IDLE_END);

        /* 시간이 흐른 만큼 기준값을 낮춥니다. */
        if (lastEventAt) {
            peakSince *= Math.pow(DECAY, Math.min(now - lastEventAt, 3000));
        }
        lastEventAt = now;

        var stronger = abs > peakSince + 1;
        if (abs > peakSince) { peakSince = abs; }

        if (!stronger) { return; }              /* 잦아드는 관성 → 무시 */
        if (now - lastStepAt < MIN_GAP) { return; }

        lastStepAt = now;
        peakSince = abs;
        step(dir);
    }

    function onWheel(e) {
        if (!engineOn) { return; }
        var d = e.deltaY;
        if (e.deltaMode === 1) { d *= 16; }
        if (e.deltaMode === 2) { d *= vh; }
        if (innerCanScroll(e.target, d)) { return; }
        e.preventDefault();
        dismissHint();
        if (Math.abs(d) < 4) { return; }
        snapStep(d > 0 ? 1 : -1, Math.abs(d));
    }

    var touchY = 0;
    var touchFrom = 0;
    function onTouchStart(e) {
        touchY = touchFrom = e.touches[0].clientY;
    }
    function onTouchMove(e) {
        if (!engineOn) { return; }
        var y = e.touches[0].clientY;
        var d = touchY - y;
        touchY = y;
        if (innerCanScroll(e.target, d)) { return; }
        e.preventDefault();
        dismissHint();
    }
    function onTouchEnd(e) {
        if (!engineOn) { return; }
        var d = touchFrom - touchY;
        if (Math.abs(d) > 44) {
            resetGesture();
            lastStepAt = 0;
            snapStep(d > 0 ? 1 : -1, Math.abs(d));
        }
    }

    function onKey(e) {
        if (!engineOn) { return; }
        var a = document.activeElement;
        var tag = a ? a.tagName : '';
        var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        var onControl = tag === 'BUTTON' || tag === 'A';

        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            if (typing) { return; }
            e.preventDefault(); dismissHint(); step(1);
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            if (typing) { return; }
            e.preventDefault(); dismissHint(); step(-1);
        } else if (e.key === ' ') {
            if (typing || onControl) { return; }
            e.preventDefault(); dismissHint(); step(1);
        } else if (e.key === 'Home') {
            e.preventDefault(); dismissHint(); goTo(0);
        } else if (e.key === 'End') {
            e.preventDefault(); dismissHint(); goTo(BLOCKS - 1);
        }
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey);

    window.addEventListener('resize', function () {
        syncViewport();
        target = clamp(target, 0, maxScroll);
        if (engineOn) { applyTransforms(); }
        setMode();
    });

    function setMode() {
        syncViewport();
        if (mqMobile.matches) { stopEngine(); } else { startEngine(); }
    }
    if (mqMobile.addEventListener) { mqMobile.addEventListener('change', setMode); }
    setMode();

    /* #block-3 처럼 해시를 붙이면 해당 구간에서 바로 열립니다. */
    function openFromHash() {
        var m = /^#block-(\d+)$/.exec(window.location.hash || '');
        if (!m) { return; }
        var i = clamp(parseInt(m[1], 10), 0, BLOCKS - 1);
        if (engineOn) {
            target = current = i * vh;
            applyTransforms();
            updateFrame(maxScroll > 0 ? current / maxScroll : 0);
            dismissHint();
        }
    }
    openFromHash();

    if (navUp)   { navUp.addEventListener('click', function () { step(-1); }); }
    if (navDown) { navDown.addEventListener('click', function () { step(1); }); }

    all('[data-goto]').forEach(function (btn) {
        btn.addEventListener('click', function () { goTo(parseInt(btn.getAttribute('data-goto'), 10)); });
    });

    all('a[href^="#block-"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            if (!engineOn) { return; }
            e.preventDefault();
            goTo(parseInt(a.getAttribute('href').replace('#block-', ''), 10));
        });
    });

    /* ================================================================
       2. 운행 시각 — "365일 운행 중" 옆에 현재 시각을 표시합니다.
       ================================================================ */

    var timeEl = $('status-time');
    function tickTime() {
        if (!timeEl) { return; }
        var d = new Date();
        timeEl.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    tickTime();
    window.setInterval(tickTime, 15000);

    /* ================================================================
       3. 서비스 아코디언 — 열린 항목이 옆 사진을 바꿉니다.
       ================================================================ */

    var accItems = all('.acc-item');
    var servicePhoto = $('service-photo');
    var serviceChip = $('service-chip');

    function setAccHeights() {
        accItems.forEach(function (item) {
            var body = item.querySelector('.acc-body');
            var inner = item.querySelector('.acc-body-in');
            body.style.maxHeight = item.classList.contains('is-open') ? inner.scrollHeight + 'px' : '0px';
        });
    }

    function showService(item) {
        var src = item.getAttribute('data-photo');
        var chip = item.getAttribute('data-chip');
        if (servicePhoto && src && servicePhoto.getAttribute('src') !== src) {
            servicePhoto.setAttribute('src', src);
            servicePhoto.setAttribute('alt', chip + ' 서비스 사진');
        }
        if (serviceChip && chip) { serviceChip.textContent = chip; }
    }

    accItems.forEach(function (item) {
        var head = item.querySelector('.acc-head');
        head.addEventListener('click', function () {
            var wasOpen = item.classList.contains('is-open');
            accItems.forEach(function (o) {
                o.classList.remove('is-open');
                o.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
            });
            if (!wasOpen) {
                item.classList.add('is-open');
                head.setAttribute('aria-expanded', 'true');
                showService(item);
            }
            setAccHeights();
        });
    });

    if (accItems.length) {
        setAccHeights();
        window.addEventListener('resize', setAccHeights);
    }

    /* ================================================================
       4. 후기 캐러셀 — 좌우 이동 · 자동 넘김 · 드래그
       ================================================================ */

    var revTrack = $('rev-track');
    var revDots = $('rev-dots');
    var revPrev = $('rev-prev');
    var revNext = $('rev-next');
    var revPlay = $('rev-play');

    if (revTrack) {
        var cards = all('.rev-card', revTrack);
        var idx = 0;
        var playing = !mqReduce.matches;
        var timer = null;
        var dots = [];

        cards.forEach(function (card, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'rev-dot' + (i === 0 ? ' is-on' : '');
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-label', (i + 1) + '번째 후기 보기');
            b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
            b.addEventListener('click', function () { stopAuto(); show(i); });
            revDots.appendChild(b);
            dots.push(b);
        });

        function show(i) {
            idx = (i + cards.length) % cards.length;
            revTrack.style.transform = 'translateX(' + (-idx * 100) + '%)';
            dots.forEach(function (d, k) {
                d.classList.toggle('is-on', k === idx);
                d.setAttribute('aria-selected', k === idx ? 'true' : 'false');
            });
            cards.forEach(function (c, k) { c.setAttribute('aria-hidden', k === idx ? 'false' : 'true'); });
        }

        function startAuto() {
            if (timer) { window.clearInterval(timer); }
            timer = window.setInterval(function () { show(idx + 1); }, 6000);
        }
        function stopAuto() {
            playing = false;
            if (timer) { window.clearInterval(timer); timer = null; }
            revPlay.classList.remove('is-playing');
            revPlay.setAttribute('aria-pressed', 'false');
            revPlay.setAttribute('aria-label', '후기 자동 넘김 시작');
        }

        revPrev.addEventListener('click', function () { stopAuto(); show(idx - 1); });
        revNext.addEventListener('click', function () { stopAuto(); show(idx + 1); });
        revPlay.addEventListener('click', function () {
            if (playing) { stopAuto(); return; }
            playing = true;
            revPlay.classList.add('is-playing');
            revPlay.setAttribute('aria-pressed', 'true');
            revPlay.setAttribute('aria-label', '후기 자동 넘김 멈추기');
            startAuto();
        });

        /* 손가락·마우스로 밀어서 넘기기 */
        var dragX = 0, dragging = false, moved = 0;
        revTrack.addEventListener('pointerdown', function (e) {
            dragging = true; dragX = e.clientX; moved = 0;
        });
        revTrack.addEventListener('pointermove', function (e) {
            if (!dragging) { return; }
            moved = e.clientX - dragX;
        });
        function endDrag() {
            if (!dragging) { return; }
            dragging = false;
            if (Math.abs(moved) > 46) { stopAuto(); show(idx + (moved < 0 ? 1 : -1)); }
        }
        revTrack.addEventListener('pointerup', endDrag);
        revTrack.addEventListener('pointercancel', endDrag);
        revTrack.addEventListener('pointerleave', endDrag);

        show(0);
        if (playing) { startAuto(); }
    }

    /* ================================================================
       5. 요금 미터 — 하루펫이 공지한 요금표를 그대로 계산합니다.
       ================================================================ */

    /* 수도권 : 하루펫 공지 요금 (2026-09-01 적용) */
    var METRO = [[0, 4800], [10, 12800], [20, 27800], [30, 42800]];

    /* 지방 장거리 : 공지 요금표 (정상 / 평일 할인 / 주말 할인) */
    var REGIONS = [
        { name: '대전', normal: 230000, weekday: 180000, weekend: 130000 },
        { name: '강릉', normal: 270000, weekday: 220000, weekend: 170000 },
        { name: '대구', normal: 350000, weekday: 300000, weekend: 250000 },
        { name: '광주', normal: 350000, weekday: 300000, weekend: 250000 },
        { name: '울산', normal: 450000, weekday: 400000, weekend: 350000 },
        { name: '부산', normal: 470000, weekday: 420000, weekend: 370000 },
        { name: '제주', normal: 600000, weekday: 510000, weekend: 500000 }
    ];

    function metroFare(km) {
        for (var i = 1; i < METRO.length; i++) {
            if (km <= METRO[i][0]) {
                var t = (km - METRO[i - 1][0]) / (METRO[i][0] - METRO[i - 1][0]);
                return Math.round((METRO[i - 1][1] + (METRO[i][1] - METRO[i - 1][1]) * t) / 100) * 100;
            }
        }
        return METRO[METRO.length - 1][1];
    }

    var meterNum = $('meter-num');
    var meterLabel = $('meter-label');
    var meterSub = $('meter-sub');
    var meterChips = $('meter-chips');
    var meterValue = document.querySelector('.meter-value');

    var kmInput = $('km');
    var kmOut = $('km-out');
    var regionBox = $('region-chips');

    var mode = 'metro';
    var region = 5;          /* 부산 */
    var day = 'weekday';

    function paintMeter(data) {
        if (!meterNum) { return; }
        meterLabel.textContent = data.label;
        meterSub.textContent = data.sub;
        meterChips.innerHTML = data.chips.map(function (c) { return '<li>' + c + '</li>'; }).join('');

        if (mqReduce.matches) { meterNum.textContent = data.num; return; }
        meterValue.classList.add('is-swap');
        window.setTimeout(function () {
            meterNum.textContent = data.num;
            meterValue.classList.remove('is-swap');
        }, 150);
    }

    function renderMeter() {
        if (mode === 'metro') {
            var km = kmInput ? parseInt(kmInput.value, 10) : 10;
            paintMeter({
                label: '수도권 · ' + km + 'km',
                num: won(metroFare(km)),
                sub: km === 0
                    ? '승차 시 표시되는 기본요금입니다'
                    : '기본요금 4,800원 포함 · 일반택시보다 2,000원 저렴',
                chips: ['단독 이동', '동승 가능', 'Door to Door']
            });
        } else {
            var r = REGIONS[region];
            var price = r[day];
            var off = r.normal - price;
            paintMeter({
                label: '지방 장거리 · 서울 → ' + r.name,
                num: won(price),
                sub: off > 0
                    ? '정상 요금 ' + won(r.normal) + '원에서 ' + won(off) + '원 할인'
                    : '할인 전 정상 요금입니다',
                chips: ['장거리 전용', '실시간 위치 안내', '단독 · 동승 선택']
            });
        }
    }

    if (kmInput) {
        var paintSlider = function () {
            var p = (kmInput.value - kmInput.min) / (kmInput.max - kmInput.min) * 100;
            kmInput.style.background =
                'linear-gradient(to right, #E7832E 0%, #E7832E ' + p + '%, #FEECBF ' + p + '%, #FEECBF 100%)';
        };
        kmInput.addEventListener('input', function () {
            kmOut.textContent = kmInput.value;
            paintSlider();
            renderMeter();
        });
        paintSlider();
    }

    if (regionBox) {
        REGIONS.forEach(function (r, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'chip' + (i === region ? ' is-on' : '');
            b.textContent = r.name;
            b.setAttribute('aria-pressed', i === region ? 'true' : 'false');
            b.addEventListener('click', function () {
                region = i;
                all('.chip', regionBox).forEach(function (c, k) {
                    c.classList.toggle('is-on', k === i);
                    c.setAttribute('aria-pressed', k === i ? 'true' : 'false');
                });
                renderMeter();
            });
            regionBox.appendChild(b);
        });
    }

    all('.seg-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            day = btn.getAttribute('data-day');
            all('.seg-btn').forEach(function (b) {
                var on = b === btn;
                b.classList.toggle('is-on', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            renderMeter();
        });
    });

    all('.tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            if (tab.classList.contains('is-on')) { return; }
            mode = tab.getAttribute('data-tab');
            all('.tab').forEach(function (t) {
                var on = t === tab;
                t.classList.toggle('is-on', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            all('.pane').forEach(function (p) {
                var on = p.id === 'pane-' + mode;
                p.classList.toggle('is-shown', on);
                p.hidden = !on;
            });
            renderMeter();
        });
    });

    renderMeter();

    /* ================================================================
       6. 등장 애니메이션
       ================================================================ */

    var reveals = all('.reveal');
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-on');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08 });
        reveals.forEach(function (el) { io.observe(el); });
    } else {
        reveals.forEach(function (el) { el.classList.add('is-on'); });
    }
    revealBlock(0);
})();
