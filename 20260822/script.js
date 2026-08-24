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

    var frameHint = $('frame-hint');
    var railList = $('rail-list');
    var railStops = [];
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
        var blk = clamp(Math.round(r * (BLOCKS - 1)), 0, BLOCKS - 1);
        if (blk === activeBlock) { return; }

        activeBlock = blk;
        railStops.forEach(function (el, i) {
            el.classList.toggle('is-on', i === blk);
            el.setAttribute('aria-current', i === blk ? 'true' : 'false');
        });
        revealBlock(blk);
        revealBlock(blk + 1);
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

    /* 노선도 정류장 : 현재 위치를 보여 주고 눌러서 이동합니다. */
    if (railList) {
        LABELS.slice(0, BLOCKS).forEach(function (name, i) {
            var li = document.createElement('li');
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'rail-stop' + (i === 0 ? ' is-on' : '');
            b.innerHTML = '<span class="rail-name">' + name + '</span><span class="rail-dot"></span>';
            b.setAttribute('aria-label', pad2(i + 1) + '구간 ' + name + '으로 이동');
            b.addEventListener('click', function () { goTo(i); });
            li.appendChild(b);
            railList.appendChild(li);
            railStops.push(b);
        });
        activeBlock = -1;   /* 방금 만든 정류장에 현재 위치를 반영합니다 */
        updateFrame(maxScroll > 0 ? current / maxScroll : 0);
    }

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
       5. 견적 요청서 — 입력한 내용을 복사하거나 PDF 로 내려받습니다.
          서버로 보내지 않고 브라우저 안에서만 처리합니다.
       ================================================================ */

    var qform = $('qform');

    if (qform) {
        var counts = { human: 1, dogS: 0, dogM: 0, dogL: 0, cat: 0 };
        var bag = '없음';

        var qDate = $('q-date');
        var qTime = $('q-time');
        var quoteList = $('quote-list');

        /* 오늘 이후만 고를 수 있게 하고, 기본값은 내일로 둡니다. */
        var today = new Date();
        function ymd(d) {
            return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        }
        if (qDate) {
            qDate.min = ymd(today);
            var tomorrow = new Date(today.getTime() + 86400000);
            qDate.value = ymd(tomorrow);
        }
        if (qTime) { qTime.value = '10:00'; }

        function val(id) {
            var el = $(id);
            return el ? el.value.trim() : '';
        }

        function joinAddr(base, detail) {
            if (!base) { return ''; }
            return detail ? base + ' ' + detail : base;
        }

        function dateText() {
            var v = val('q-date');
            if (!v) { return ''; }
            var parts = v.split('-');
            var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
            var days = ['일', '월', '화', '수', '목', '금', '토'];
            return parts[0] + '년 ' + (+parts[1]) + '월 ' + (+parts[2]) + '일 (' + days[d.getDay()] + ')';
        }

        function timeText() {
            var v = val('q-time');
            if (!v) { return ''; }
            var hh = parseInt(v.split(':')[0], 10);
            var mm = v.split(':')[1];
            var ampm = hh < 12 ? '오전' : '오후';
            var h12 = hh % 12; if (h12 === 0) { h12 = 12; }
            return ampm + ' ' + h12 + '시' + (mm === '00' ? '' : ' ' + parseInt(mm, 10) + '분');
        }

        function petText() {
            var parts = [];
            if (counts.dogS) { parts.push('소형견 ' + counts.dogS + '마리'); }
            if (counts.dogM) { parts.push('중형견 ' + counts.dogM + '마리'); }
            if (counts.dogL) { parts.push('대형견 ' + counts.dogL + '마리'); }
            if (counts.cat)  { parts.push('고양이 ' + counts.cat + '마리'); }
            return parts.join(', ');
        }

        /* 견적서에 들어갈 항목을 한 곳에서 만듭니다. */
        function rows() {
            return [
                ['이용 날짜', dateText()],
                ['출발 시간', timeText()],
                ['출발지', joinAddr(val('q-from'), val('q-from-detail'))],
                ['도착지', joinAddr(val('q-to'), val('q-to-detail'))],
                ['탑승 인원', counts.human ? '보호자 ' + counts.human + '명' : '보호자 동승 없음'],
                ['반려동물', petText()],
                ['짐', bag],
                ['요청사항', val('q-note')]
            ];
        }

        var EMPTY = '입력 전';

        function renderPreview() {
            if (!quoteList) { return; }
            quoteList.innerHTML = rows().map(function (r) {
                var filled = !!r[1];
                return '<div class="quote-row' + (filled ? '' : ' is-empty') + '">' +
                       '<dt>' + r[0] + '</dt><dd>' + (filled ? escapeHtml(r[1]) : EMPTY) + '</dd></div>';
            }).join('');
        }

        function escapeHtml(t) {
            return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        /* 카카오톡·톡톡에 붙여넣기 좋은 형태 */
        function plainText() {
            var lines = ['[하루펫 견적 요청]'];
            rows().forEach(function (r) {
                if (r[1]) { lines.push(r[0] + ' : ' + r[1]); }
            });
            return lines.join('\n');
        }

        /* ── 수량 조절 ── */
        all('.qty', qform).forEach(function (box) {
            var key = box.getAttribute('data-key');
            var out = box.querySelector('.qty-v');
            all('.qty-btn', box).forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var d = parseInt(btn.getAttribute('data-step'), 10);
                    counts[key] = clamp(counts[key] + d, 0, 20);
                    out.textContent = counts[key];
                    box.classList.toggle('is-set', counts[key] > 0);
                    renderPreview();
                });
            });
            box.classList.toggle('is-set', counts[key] > 0);
        });

        /* ── 짐 선택 ── */
        all('#q-bag .chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                bag = chip.getAttribute('data-val');
                all('#q-bag .chip').forEach(function (c) {
                    var on = c === chip;
                    c.classList.toggle('is-on', on);
                    c.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
                renderPreview();
            });
        });

        /* ── 주소 검색 (다음 우편번호 서비스) ── */
        all('.qsearch').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var field = $(btn.getAttribute('data-addr'));
                if (!field) { return; }
                if (typeof window.daum === 'undefined' || !window.daum.Postcode) {
                    /* 검색 도구를 못 불러오면 직접 입력할 수 있게 풀어 줍니다. */
                    field.readOnly = false;
                    field.placeholder = '주소를 직접 입력해 주세요';
                    field.focus();
                    return;
                }
                new window.daum.Postcode({
                    oncomplete: function (data) {
                        field.value = data.roadAddress || data.jibunAddress;
                        renderPreview();
                        var detail = $(field.id + '-detail');
                        if (detail) { detail.focus(); }
                    }
                }).open();
            });
        });

        all('input, textarea', qform).forEach(function (el) {
            el.addEventListener('input', renderPreview);
            el.addEventListener('change', renderPreview);
        });

        /* ── 내용 복사하기 ── */
        var copyBtn = $('q-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                var text = plainText();
                function done() {
                    var old = copyBtn.innerHTML;
                    copyBtn.classList.add('is-done');
                    copyBtn.innerHTML = '복사했습니다 · 붙여넣기 하세요';
                    window.setTimeout(function () {
                        copyBtn.innerHTML = old;
                        copyBtn.classList.remove('is-done');
                    }, 2200);
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(done, fallback);
                } else {
                    fallback();
                }
                function fallback() {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    ta.setAttribute('readonly', '');
                    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
                    document.body.appendChild(ta);
                    ta.select();
                    ta.setSelectionRange(0, text.length);
                    try { document.execCommand('copy'); done(); } catch (e) { window.prompt('아래 내용을 복사해 주세요', text); }
                    document.body.removeChild(ta);
                }
            });
        }

        /* ── 견적서 내려받기 (브라우저 인쇄 → PDF 로 저장) ── */
        var pdfBtn = $('q-pdf');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', function () {
                var body = $('sheet-body');
                var made = $('sheet-made');
                if (body) {
                    body.innerHTML = rows().map(function (r) {
                        return '<tr><th>' + r[0] + '</th><td>' + (r[1] ? escapeHtml(r[1]) : '-') + '</td></tr>';
                    }).join('');
                }
                if (made) {
                    var n = new Date();
                    made.textContent = '작성일 ' + n.getFullYear() + '. ' + pad2(n.getMonth() + 1) + '. ' + pad2(n.getDate());
                }
                /* 저장되는 파일 이름이 되므로 잠시 문서 제목을 바꿉니다. */
                var title = document.title;
                document.title = '하루펫_견적요청서_' + (val('q-date') || '').replace(/-/g, '');
                window.print();
                window.setTimeout(function () { document.title = title; }, 600);
            });
        }

        renderPreview();
    }

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
