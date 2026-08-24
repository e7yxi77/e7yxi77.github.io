/* ==================================================================
   하루펫택시 — 인터랙션
   외부 라이브러리 없음 · 백엔드 없음 · 순수 자바스크립트
   ================================================================== */

(function () {
    'use strict';

    /* ================================================================
       설정 — 여기 두 곳만 바꾸면 후기와 리뷰 작성 링크가 갱신됩니다.
       ================================================================ */

    /* "리뷰 추가하기" 버튼이 여는 주소.
       네이버 플레이스 리뷰 페이지가 준비되면 그 주소로 바꿔주세요. */
    var REVIEW_WRITE_URL = 'https://talk.naver.com/ct/w5xpj1';

    var REVIEWS = [
        {
            name: '김*진', score: 5, tag: '병원 이동', img: 'images/review-1.jpg',
            text: '기사님이 정말 친절하시고 우리 강아지도 편안해했어요! 운전도 안전하게 해주셔서 너무 감사했습니다.'
        },
        {
            name: '박*영', score: 5, tag: '지방 장거리', img: 'images/review-2.jpg',
            text: '장거리 이동이 걱정됐는데 하루펫 덕분에 편안하게 다녀왔어요! 다음에도 또 이용할게요.'
        },
        {
            name: '이*민', score: 5, tag: '고양이 이동', img: 'images/review-3.jpg',
            text: '고양이가 예민한데도 불구하고 조용하고 안전하게 이동해주셔서 너무 만족합니다. 정말 믿고 맡길 수 있어요!'
        },
        {
            name: '최*훈', score: 5, tag: '왕복 이용', img: 'images/review-4.jpg',
            text: '예약부터 이용까지 모두 매우 만족스러웠습니다. 친절함과 세심함에 감동했어요! 강력 추천합니다.'
        }
    ];

    /* ---------------------------------------------------------------- */

    function $(id) { return document.getElementById(id); }
    function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function starRow(n) {
        var s = '';
        for (var i = 0; i < 5; i++) { s += i < n ? '★' : '☆'; }
        return s;
    }

    var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* ================================================================
       1. 후기 — 홈은 가로 카드, 후기 페이지는 목록으로 같은 데이터를 씁니다.
       ================================================================ */

    var rail = $('review-rail');
    if (rail) {
        rail.innerHTML = REVIEWS.map(function (r) {
            return '<article class="rv">' +
                '<div class="rv-top"><span class="stars" aria-label="별점 5점 만점에 ' + r.score + '점">' +
                    starRow(r.score) + '</span><span class="rv-sc">' + r.score.toFixed(1) + '</span></div>' +
                '<p class="rv-txt">' + esc(r.text) + '</p>' +
                '<p class="rv-by">' + esc(r.name) + ' 고객님<span class="rv-tag">' + esc(r.tag) + '</span></p>' +
            '</article>';
        }).join('');
    }

    var rvList = $('rv-list');
    if (rvList) {
        rvList.innerHTML = REVIEWS.map(function (r) {
            return '<article class="rv-item">' +
                '<img src="' + r.img + '" alt="" width="96" height="96" loading="lazy">' +
                '<div>' +
                    '<div class="rv-top"><span class="stars" aria-label="별점 5점 만점에 ' + r.score + '점">' +
                        starRow(r.score) + '</span><span class="rv-sc">' + r.score.toFixed(1) + '</span></div>' +
                    '<p class="rv-txt">' + esc(r.text) + '</p>' +
                    '<p class="rv-by">' + esc(r.name) + ' 고객님<span class="rv-tag">' + esc(r.tag) + '</span></p>' +
                '</div>' +
            '</article>';
        }).join('');

        var avg = REVIEWS.reduce(function (a, r) { return a + r.score; }, 0) / REVIEWS.length;
        if ($('rv-avg')) { $('rv-avg').textContent = avg.toFixed(1); }
        if ($('rv-count')) { $('rv-count').textContent = REVIEWS.length; }

        /* 별점 분포 막대 */
        var bars = $('rv-bars');
        if (bars) {
            bars.innerHTML = [5, 4, 3, 2, 1].map(function (n) {
                var c = REVIEWS.filter(function (r) { return r.score === n; }).length;
                var pct = REVIEWS.length ? Math.round(c / REVIEWS.length * 100) : 0;
                return '<div class="bar-row"><span>' + n + '점</span>' +
                       '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
                       '<span>' + c + '건</span></div>';
            }).join('');
        }
    }

    var writeBtn = $('rv-write');
    if (writeBtn) { writeBtn.href = REVIEW_WRITE_URL; }

    /* ================================================================
       2. 카테고리 탭 — 지금 보고 있는 구간을 표시합니다.
       ================================================================ */

    var tabBox = $('tabs');
    if (tabBox) {
        var tabs = all('.tab', tabBox).filter(function (t) {
            return (t.getAttribute('href') || '').charAt(0) === '#';
        });
        var targets = tabs.map(function (t) { return document.querySelector(t.getAttribute('href')); });

        function markTab(i) {
            tabs.forEach(function (t, k) { t.classList.toggle('is-on', k === i); });
            /* 활성 탭이 가로 스크롤 밖에 있으면 보이도록 당겨 옵니다. */
            var el = tabs[i];
            if (el && tabBox.scrollWidth > tabBox.clientWidth) {
                var left = el.offsetLeft - (tabBox.clientWidth - el.offsetWidth) / 2;
                tabBox.scrollTo({ left: Math.max(0, left), behavior: mqReduce.matches ? 'auto' : 'smooth' });
            }
        }

        if ('IntersectionObserver' in window) {
            var seen = {};
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
                var best = -1, bestV = 0;
                targets.forEach(function (t, k) {
                    if (!t) { return; }
                    var v = seen[t.id] || 0;
                    if (v > bestV) { bestV = v; best = k; }
                });
                if (best >= 0) { markTab(best); }
            }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .25, .5, 1] });
            targets.forEach(function (t) { if (t) { io.observe(t); } });
        }
    }

    /* ================================================================
       3. 등장 애니메이션
       ================================================================ */

    var rises = all('.rise');
    if (rises.length) {
        if ('IntersectionObserver' in window) {
            var rio = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) { e.target.classList.add('is-on'); rio.unobserve(e.target); }
                });
            }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
            rises.forEach(function (el) { rio.observe(el); });
        } else {
            rises.forEach(function (el) { el.classList.add('is-on'); });
        }
    }

    /* ================================================================
       4. 견적 요청서 — 서버로 보내지 않고 브라우저 안에서만 처리합니다.
       ================================================================ */

    var qform = $('qform');
    if (!qform) { return; }

    var counts = { human: 1, dogS: 0, dogM: 0, dogL: 0, cat: 0 };
    var bag = '없음';

    var qDate = $('q-date');
    var qTime = $('q-time');
    var quoteList = $('quote-list');

    function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

    var today = new Date();
    if (qDate) {
        qDate.min = ymd(today);
        qDate.value = ymd(new Date(today.getTime() + 86400000));
    }
    if (qTime) { qTime.value = '10:00'; }

    function val(id) { var el = $(id); return el ? el.value.trim() : ''; }
    function joinAddr(base, detail) { return base ? (detail ? base + ' ' + detail : base) : ''; }

    function dateText() {
        var v = val('q-date');
        if (!v) { return ''; }
        var p = v.split('-');
        var d = new Date(+p[0], +p[1] - 1, +p[2]);
        var days = ['일', '월', '화', '수', '목', '금', '토'];
        return p[0] + '년 ' + (+p[1]) + '월 ' + (+p[2]) + '일 (' + days[d.getDay()] + ')';
    }

    function timeText() {
        var v = val('q-time');
        if (!v) { return ''; }
        var hh = parseInt(v.split(':')[0], 10), mm = v.split(':')[1];
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

    function renderPreview() {
        if (!quoteList) { return; }
        quoteList.innerHTML = rows().map(function (r) {
            var filled = !!r[1];
            return '<div class="quote-row' + (filled ? '' : ' is-empty') + '">' +
                   '<dt>' + r[0] + '</dt><dd>' + (filled ? esc(r[1]) : '입력 전') + '</dd></div>';
        }).join('');
    }

    /* 카카오톡·톡톡에 붙여넣기 좋은 형태 */
    function plainText() {
        var lines = ['[하루펫 견적 요청]'];
        rows().forEach(function (r) { if (r[1]) { lines.push(r[0] + ' : ' + r[1]); } });
        return lines.join('\n');
    }

    /* ── 수량 조절 ── */
    all('.qty', qform).forEach(function (box) {
        var key = box.getAttribute('data-key');
        var out = box.querySelector('.qty-v');
        all('.qty-btn', box).forEach(function (btn) {
            btn.addEventListener('click', function () {
                counts[key] = clamp(counts[key] + parseInt(btn.getAttribute('data-step'), 10), 0, 20);
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
            var old = copyBtn.innerHTML;

            function done() {
                copyBtn.classList.add('is-done');
                copyBtn.innerHTML = '복사했습니다 · 붙여넣기 하세요';
                window.setTimeout(function () {
                    copyBtn.innerHTML = old;
                    copyBtn.classList.remove('is-done');
                }, 2200);
            }
            function fallback() {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                ta.setSelectionRange(0, text.length);
                try { document.execCommand('copy'); done(); }
                catch (e) { window.prompt('아래 내용을 복사해 주세요', text); }
                document.body.removeChild(ta);
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, fallback);
            } else {
                fallback();
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
                    return '<tr><th>' + r[0] + '</th><td>' + (r[1] ? esc(r[1]) : '-') + '</td></tr>';
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
})();
