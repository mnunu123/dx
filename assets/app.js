/* 할증레이더 프로토타입 화면. 계산은 engine.js(계산 테스트 16건 통과본)를 그대로 쓴다. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const money = (cur, n) => (n == null ? '금액 없음' : `${cur || ''} ${fmt(n)}`.trim());
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const day = (s) => new Date(s + 'T00:00:00Z');
  const addDays = (s, n) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diffDays = (a, b) => Math.round((day(a) - day(b)) / 864e5);
  const kd = (s) => (s ? `${+s.slice(5, 7)}/${+s.slice(8, 10)}(${DOW[day(s).getUTCDay()]})` : '—');

  const CAT = { emergency_fuel: '긴급 유류', conflict_war_risk: '분쟁·전쟁 위험', contingency_cost_recovery: '비상 비용 회수', bunker_regular: '정기 유류', rate_increase: '운임 인상', environmental: '환경 규제', local_port: '항만·현지 비용', other: '기타', unknown: '분류 불명' };
  const UNIT = { per_container: '컨테이너당', per_teu: 'TEU당', per_bl: 'B/L당', percent_of_base: '운임 대비 %', other: '기타 단위', not_stated: '단위 미기재' };
  const TYPE = { dry: 'Dry', reefer: 'Reefer', special: '특수', tank: 'Tank', open_top: 'Open Top', flat_rack: 'Flat Rack', dg: '위험물', all: '전 타입', not_stated: '타입 미기재' };
  const SIZE = { 20: "20'", 40: "40'", '40HC': "40'HC", 45: "45'", all: '전 크기', not_stated: '크기 미기재' };
  const BASIS = { booking_date: '부킹일', price_calculation_date: '가격 산정일', departure_date: '출항일', loading_date: '선적일', gate_in_date: '반입일', bl_date: 'B/L 발행일', arrival_date: '입항일', cargo_status: '화물 상태', not_stated: '미기재' };
  const PAY = { origin: '출발지', destination: '도착지', freight_payer: '운임 지불자', not_stated: '미기재' };
  const DIR = { export_from_kr: '한국발 수출', import_to_kr: '한국향 수입', headhaul: 'Headhaul', backhaul: 'Backhaul', all_directions: '전 방향', from_or_to: '출발 또는 도착', not_stated: '방향 미기재' };
  const KIND = { new: '신규', revision: '변경', extension: '연장', cancellation: '취소', informational: '안내' };
  const COND = { effective_date_varies_by_origin: '출발지별 적용일 다름', until_further_notice: '별도 공지 전까지', immediate_effect: '즉시 적용', reviewed_periodically: '정기 재검토', may_be_included_in_freight: '운임에 포함됐을 수 있음', amount_not_in_notice: '금액은 공지에 없음', included_in_freight: '운임에 포함', non_refundable: '환불 불가', contract_bookings_only: '계약 부킹만', subject_to_regulatory_approval: '규제 승인 전제', applies_to_cargo_in_transit: '운항 중 화물에도 적용', unclear: '불명확', rates_by_routing: '경로별 요율' };
  const REASON = { schema: '형식 오류', evidence: '근거 구절이 원문에 없음', verbatim: '원문 표기가 원문과 다름', tag: '정의 밖 태그', amount_ev: '금액이 근거 구절에 없음', no_amount: '금액 없음', unit: '단위 없음', currency: '통화 형식', no_date: '적용 시작일 없음', code: '약어 사전에 없는 약어', category: '분류 불명' };
  const AI = {
    auto: ['ok', '사람 확인', 'AI 추출이 정답과 같았고, 검사기가 자동 승인한 할증'],
    reviewed: ['ok', '사람 확인', 'AI 추출이 정답과 같았고, 검사기가 사람 확인으로 보낸 할증'],
    corrected: ['ok', '사람 확인', 'AI 추출이 정답과 다르거나 빠진 할증(정답 값을 씀)'],
    ai_auto: ['warn', 'AI, 확인 전', 'AI 추출 결과. 검사기는 자동 승인, 사람 확인은 아직'],
    ai_review: ['warn', 'AI, 확인 요청', 'AI 추출 결과. 검사기가 사람 확인이 필요하다고 표시'],
  };
  const VERIFIED = ['auto', 'reviewed', 'corrected']; // 정답 라벨이 있는 상태. 사람 확인 여부는 r.human
  const OCEAN = ['emergency_fuel', 'conflict_war_risk', 'contingency_cost_recovery', 'bunker_regular', 'rate_increase', 'environmental'];
  const CARRIER_ORDER = ['Maersk', 'MSC', 'CMA CGM', 'ONE', 'Evergreen', '장금상선', '흥아라인'];
  const SERIES = { Maersk: 'var(--s1)', MSC: 'var(--s2)', 'CMA CGM': 'var(--s3)', ONE: 'var(--s4)' };

  const S = { db: null, sc: null, rep: null, wk: null, inbox: { carrier: '', status: '', q: '' }, drawn: {} };

  // ---------- 공통 ----------
  const tip = $('#tip');
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    tip.style.left = Math.max(8, left) + 'px'; tip.style.top = Math.max(8, top) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  const chip = (kind, text, title) => `<span class="chip ${kind}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
  const aiChip = (ai) => { const a = AI[ai] || ['plain', ai, '']; return chip(a[0], a[1], a[2]); };
  // 레코드 상태: 사람 확인(시험·test 정답) / Claude 정답 라벨(dev, 사람 확인 전) / AI 추출(정답 없음)
  const recChip = (r) => {
    if (VERIFIED.includes(r.ai) && !r.human) return chip('warn', 'Claude 정답, 확인 전', 'Claude가 만든 정답 라벨(dev). 지시문을 다듬는 데 썼고 사람이 원문과 대조하지는 않음. ' + (AI[r.ai] || [])[2]);
    return aiChip(r.ai);
  };
  const recLabel = (r) => r.code_as_written || r.name_as_written || '(이름 없음)';
  const condText = (c) => (c.startsWith('grouped:') ? '묶음: ' + c.slice(8) : c.startsWith('excludes:') ? '제외: ' + c.slice(9) : c.startsWith('percent_of:') ? '기준: ' + c.slice(11) : COND[c] || c);
  const noticeHref = (nid, idx) => '#notices/' + encodeURIComponent(nid) + (idx != null ? '/' + idx : '');
  const recIdx = (r) => r.id.split('#').pop();

  // 근거 구절 안에서 금액·시작일 표기·약어를 표시한다
  function highlight(text, r) {
    const pats = [];
    if (r.amount != null) {
      const a = Number(r.amount);
      const forms = new Set([String(a), a.toLocaleString('en-US', { maximumFractionDigits: 2 })]);
      forms.forEach((f) => pats.push(new RegExp('(?<![\\d.,])' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d])', 'g')));
    }
    [r.effective_from_text, r.code_as_written].filter((t) => t && t.length >= 2).forEach((t) => pats.push(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')));
    const spans = [];
    pats.forEach((re) => { let m; while ((m = re.exec(text))) { spans.push([m.index, m.index + m[0].length]); if (!m[0].length) re.lastIndex++; } });
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [];
    spans.forEach((s) => { const l = merged[merged.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else merged.push([...s]); });
    let out = '', at = 0;
    merged.forEach(([a, b]) => { out += esc(text.slice(at, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>'; at = b; });
    return out + esc(text.slice(at));
  }

  // ---------- 라우팅 ----------
  const VIEWS = { overview: viewOverview, weekly: viewWeekly, notices: viewNotices, timeline: viewTimeline, calc: viewCalc, report: viewReport };
  let current = null;
  function route() {
    const parts = location.hash.slice(1).split('/').map((p) => decodeURIComponent(p));
    const v = VIEWS[parts[0]] ? parts[0] : 'overview';
    $$('.view').forEach((el) => { el.hidden = el.dataset.view !== v; });
    $$('.tabs a').forEach((a) => (a.dataset.view === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    const changed = current !== v;
    current = v;
    document.title = v === 'overview' ? '할증레이더' : `${$(`.tabs a[data-view="${v}"]`).textContent} | 할증레이더`;
    if (changed) window.scrollTo(0, 0);
    if (!S.db) return;
    VIEWS[v](parts.slice(1), changed);
  }
  window.addEventListener('hashchange', route);

  // ---------- 개요 ----------
  let overviewDone = false;
  function viewOverview() {
    if (overviewDone) return;
    overviewDone = true;
    const t = S.rep.tables.test.find((x) => x.run === 'sonnet_v1');
    const ev = S.sc.events;
    const val = {
      exact: t.exact, gold: t.gold, autoExact: t.auto_exact, auto: t.auto, reviewPct: (100 * t.review / t.validated).toFixed(1) + '%',
      late: S.sc.summary.events_after_effective_weekly, events: ev.length,
      agentMedian: Math.round(S.rep.timing.agent.sonnet.median) + '초', valMs: S.rep.timing.machine.validator.median_ms + 'ms', calcMs: S.rep.timing.machine.calculator.median_ms + 'ms',
    };
    $$('[data-fill]').forEach((el) => { if (val[el.dataset.fill] != null) el.textContent = val[el.dataset.fill]; });
  }
  // 원문 표시와 추출 칸을 서로 연결(마우스·키보드)
  (function traceLink() {
    const fig = $('.trace');
    if (!fig) return;
    const on = (k, v) => $$(`[data-k="${k}"]`, fig).forEach((el) => el.classList.toggle('on', v));
    $$('[data-k]', fig).forEach((el) => {
      if (el.tagName === 'DIV') el.tabIndex = 0;
      ['mouseenter', 'focus'].forEach((e) => el.addEventListener(e, () => on(el.dataset.k, true)));
      ['mouseleave', 'blur'].forEach((e) => el.addEventListener(e, () => on(el.dataset.k, false)));
    });
    requestAnimationFrame(() => fig.classList.add('play'));
  })();


  // ---------- 주간 브리핑 ----------
  // 한 주(월~일)에 새로 게시된 공지와, 그 공지 때문에 할증 합계가 바뀌는 진행 중 부킹(가상)을 보여준다.
  // 진행 중 = 그 주 일요일까지 부킹했고, 그 주 월요일 이후 출항. 비교 = 그 주 전날까지 게시된 공지 vs 그 주까지 게시된 공지.
  const monday = (d) => { const x = day(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const portKo = (c) => Geo.portName[c] || c;
  function weekList() {
    const by = {};
    Object.values(S.db.notices).forEach((n) => { if (n.published_date) { const w = monday(n.published_date); by[w] = (by[w] || 0) + 1; } });
    return Object.entries(by).filter(([w]) => w >= '2025-12-29').sort((a, b) => a[0].localeCompare(b[0]));
  }
  function totalsMax(t) { const o = {}; if (t) Object.entries(t).forEach(([cur, m]) => { o[cur] = m.max; }); return o; }
  function weekData(w) {
    const we = addDays(w, 6);
    const notices = Object.entries(S.db.notices).filter(([, n]) => n.published_date && n.published_date >= w && n.published_date <= we)
      .sort((a, b) => a[1].published_date.localeCompare(b[1].published_date));
    const before = dbAsOf(addDays(w, -1)), after = dbAsOf(we);
    const live = S.wk.bookings.filter((b) => b.booking <= we && b.etd >= w);
    const rows = [];
    let calcMs = 0;
    live.forEach((b) => {
      const ship = { carrier: b.carrier, origin: b.origin, destination: b.destination, size: b.size, type: b.type, qty: b.qty, booking: b.booking, etd: b.etd, includeLocal: false, categories: OCEAN };
      const t0 = performance.now();
      const a = Calc.calculate(before, ship, Geo), c = Calc.calculate(after, ship, Geo);
      calcMs += performance.now() - t0;
      const aIds = new Set(a.lines.map((l) => l.r.id)), cIds = new Set(c.lines.map((l) => l.r.id));
      const added = c.lines.filter((l) => !aIds.has(l.r.id) && l.status !== 'included');
      const gone = a.lines.filter((l) => !cIds.has(l.r.id) && l.status !== 'included');
      const ta = totalsMax(a.totals[b.carrier]), tc = totalsMax(c.totals[b.carrier]);
      const delta = {};
      new Set([...Object.keys(ta), ...Object.keys(tc)]).forEach((cur) => { const d = (tc[cur] || 0) - (ta[cur] || 0); if (d) delta[cur] = d; });
      const row = { b, ship, ta, tc, delta, added, gone };
      row.hit = Object.keys(delta).length > 0 || added.length > 0 || gone.length > 0;
      rows.push(row);
    });
    const hits = rows.filter((r) => r.hit).sort((x, y) => Math.abs(y.delta.USD || 0) - Math.abs(x.delta.USD || 0));
    const usd = hits.reduce((s2, r) => s2 + (r.delta.USD || 0), 0);
    return { w, we, notices, live, rows, hits, usd, calcMs };
  }
  const signMoney = (cur, n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${cur} ${fmt(Math.abs(n))}`;
  const curList = (o) => (Object.keys(o).length ? Object.entries(o).map(([cur, n]) => money(cur, n)).join(' + ') : '0');
  function viewWeekly(args) {
    const el = $('#view-weekly');
    const weeks = weekList();
    if (!el.dataset.ready) {
      el.dataset.ready = 1;
      el.innerHTML = `
        <div class="view-head"><h1>주간 브리핑</h1>
          <p>한 주 동안 새로 나온 선사 공지와, 그 공지 때문에 할증 합계가 바뀌는 진행 중 부킹을 골라 보여줍니다. 매주 월요일 KCCI 발표와 같은 주기로 보는 화면입니다. 부킹 목록은 <b>가상 예시</b>(부산 출발, 주 8~12건)이고, 공지와 할증은 실제 수집한 것입니다.</p></div>
        <div class="wk-bar">
          <button class="btn small" type="button" id="wk-prev" aria-label="이전 주">이전 주</button>
          <select id="wk-sel" aria-label="주 선택">${weeks.map(([w, n]) => `<option value="${w}">${kd(w)} ~ ${kd(addDays(w, 6))}, 공지 ${n}건</option>`).join('')}</select>
          <button class="btn small" type="button" id="wk-next" aria-label="다음 주">다음 주</button>
        </div>
        <div id="wk-body" aria-live="polite"></div>`;
      const go = (w) => { location.hash = '#weekly/' + w; };
      $('#wk-sel').addEventListener('change', (e) => go(e.target.value));
      $('#wk-prev').addEventListener('click', () => { const i = weeks.findIndex(([w]) => w === $('#wk-sel').value); if (i > 0) go(weeks[i - 1][0]); });
      $('#wk-next').addEventListener('click', () => { const i = weeks.findIndex(([w]) => w === $('#wk-sel').value); if (i < weeks.length - 1) go(weeks[i + 1][0]); });
    }
    const w = weeks.some(([x]) => x === args[0]) ? args[0] : '2026-02-23';
    $('#wk-sel').value = w;
    const i = weeks.findIndex(([x]) => x === w);
    $('#wk-prev').disabled = i <= 0; $('#wk-next').disabled = i >= weeks.length - 1;
    renderWeek(weekData(w));
  }
  function lineText(l, ship) { return `${recLabel(l.r)} ${l.total == null ? '금액 없음' : money(l.r.currency, l.total)}${l.status === 'alternative' ? '(후보)' : ''}`; }
  function renderWeek(D) {
    // KCCI는 매주 월요일 발표. 그 주 발표가 없으면(연휴 등) 그 전 발표를 쓰고 날짜를 적는다.
    const ks = S.wk.kcci.filter((x) => x.date <= D.we).sort((a, b) => a.date.localeCompare(b.date));
    const k = ks.at(-1), kp = ks.at(-2);
    const kc = (v, p) => (p ? `${fmt(v)} <span class="muted small">(직전 대비 ${v - p >= 0 ? '+' : '−'}${fmt(Math.abs(v - p))})</span>` : fmt(v));
    const carriers = [...new Set(D.notices.map(([, n]) => n.carrier))];
    const unverified = D.hits.some((r) => r.added.some((l) => !Calc.humanOk(l.r)));
    let html = `<div class="cmp wk-stats">
      <div><span>새 공지</span><b class="num">${D.notices.length}건</b><span>${esc(carriers.join(', ') || '없음')}</span></div>
      <div><span>금액이 바뀌는 진행 중 부킹</span><b class="num">${D.hits.length}건</b><span>진행 중 ${D.live.length}건 중</span></div>
      <div><span>해상 할증 변화(USD)</span><b class="num ${D.usd > 0 ? 'up' : D.usd < 0 ? 'down' : ''}">${D.usd ? signMoney('USD', D.usd) : '0'}</b><span>대안이 있으면 큰 값 기준</span></div>
      <div><span>KCCI 종합(${k ? kd(k.date) : ''} 발표)</span><b class="num">${k ? kc(k.kcci, kp && kp.kcci) : '—'}</b><span>중동항로 ${k ? kc(k.kmei, kp && kp.kmei) : '—'}</span></div>
    </div>`;
    html += `<div class="panel"><div class="panel-h"><h2>금액이 바뀌는 부킹 ${D.hits.length}건</h2><span class="small muted">부킹 ${D.live.length}건 × 2회 계산 ${D.calcMs.toFixed(0)}ms</span></div>
      <p>이 주 전날까지 게시된 공지로 계산한 합계와, 이 주 공지까지 넣은 합계를 비교했습니다. 해상 할증만 봅니다.${unverified ? ' 사람 확인 전 데이터가 섞인 줄에는 표시를 붙였습니다.' : ''}</p>
      ${D.hits.length ? `<div class="tbl-wrap" style="margin-top:12px"><table class="lines wk"><thead><tr><th>부킹</th><th>화물</th><th class="r">변경 전 → 후</th><th class="r">차이</th><th>원인</th></tr></thead><tbody>${D.hits.map((r) => {
        const b = r.b;
        const cause = [...r.added.map((l) => `<li><span class="plus">+</span> <a href="${noticeHref(l.r.notice_id, recIdx(l.r))}">${esc(lineText(l, r.ship))}</a> <span class="muted">${kd(l.notice.published_date)} 게시</span>${Calc.humanOk(l.r) ? '' : ' ' + recChip(l.r)}</li>`),
          ...r.gone.map((l) => `<li><span class="minus">−</span> ${esc(lineText(l, r.ship))} <span class="muted">새 공지로 대체</span></li>`)].join('');
        return `<tr><td><b>${esc(b.id)}</b><span class="nm">${esc(b.carrier)}</span></td>
          <td>${esc(portKo(b.origin))} → ${esc(portKo(b.destination))}<span class="nm">${esc(SIZE[b.size])} ${b.qty}개, 부킹 ${kd(b.booking)}, 출항 ${kd(b.etd)}</span></td>
          <td class="r num">${esc(curList(r.ta))} → ${esc(curList(r.tc))}</td>
          <td class="r num">${Object.keys(r.delta).length ? Object.entries(r.delta).map(([cur, n]) => `<b class="${n > 0 ? 'up' : 'down'}">${esc(signMoney(cur, n))}</b>`).join('<br>') : '<span class="muted">금액 없음</span>'}</td>
          <td><ul class="cause">${cause}</ul></td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="empty">이 주 공지로 금액이 바뀌는 진행 중 부킹이 없습니다. 수집한 공지와 가상 부킹 범위 안에서의 결과입니다.</div>'}</div>`;
    html += `<div class="panel"><div class="panel-h"><h2>이 주에 게시된 공지 ${D.notices.length}건</h2></div>
      ${D.notices.length ? `<div class="tbl-wrap" style="margin-top:10px"><table class="stack"><thead><tr><th>게시</th><th>선사</th><th>공지</th><th>할증·요금</th><th>데이터</th></tr></thead><tbody>${D.notices.map(([nid, n]) => {
        const recs = S.db.records.filter((r) => r.notice_id === nid);
        const codes = [...new Set(recs.map(recLabel))];
        const st = n.human ? chip('ok', '사람 확인') : n.labeled ? chip('warn', 'Claude 정답, 확인 전') : chip('warn', 'AI, 확인 전');
        return `<tr><td class="num">${kd(n.published_date)}</td><td style="white-space:nowrap">${esc(n.carrier)}</td><td class="full"><a href="${noticeHref(nid)}">${esc(n.title || nid)}</a></td>
          <td>${recs.length ? `${esc(codes.slice(0, 4).join(', '))}${codes.length > 4 ? ` 외 ${codes.length - 4}` : ''}<span class="nm">${recs.length}개</span>` : '<span class="muted">할증 없음</span>'}</td><td>${st}</td></tr>`;
      }).join('')}</tbody></table></div>` : ''}</div>`;
    const quiet = D.rows.filter((r) => !r.hit);
    html += `<details class="sub panel" style="padding:14px 20px"><summary>변화 없는 진행 중 부킹 ${quiet.length}건 보기</summary>
      <div class="tbl-wrap" style="margin-top:10px"><table class="stack"><thead><tr><th>부킹</th><th>선사</th><th>화물</th><th class="r">해상 할증 합계</th></tr></thead><tbody>${quiet.map((r) => `<tr><td>${esc(r.b.id)}</td><td>${esc(r.b.carrier)}</td>
        <td>${esc(portKo(r.b.destination))}, ${esc(SIZE[r.b.size])} ${r.b.qty}개, 출항 ${kd(r.b.etd)}</td><td class="r num">${esc(curList(r.tc))}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted" style="margin-top:8px">${esc(S.wk.note)} 할증 합계가 0인 부킹은 수집한 공지에 그 선사·구간의 할증이 없다는 뜻이지, 실제로 할증이 없다는 뜻은 아닙니다.</p></details>`;
    $('#wk-body').innerHTML = html;
  }

  // ---------- 공지함 ----------
  function noticeStats(nid) {
    const recs = S.db.records.filter((r) => r.notice_id === nid);
    const c = {}; recs.forEach((r) => { c[r.ai] = (c[r.ai] || 0) + 1; });
    return { recs, c };
  }
  function viewNotices(args) {
    const el = $('#view-notices');
    if (!el.dataset.ready) {
      el.dataset.ready = 1;
      const carriers = CARRIER_ORDER.filter((c) => Object.values(S.db.notices).some((n) => n.carrier === c));
      el.innerHTML = `
        <div class="view-head"><h1>공지함</h1><p>선사 공지에서 뽑은 할증을 공지별로 봅니다. 할증을 누르면 공지 원문의 근거 구절이 나오고, 금액·시작일·약어가 표시됩니다.</p></div>
        <div class="inbox">
          <div class="inbox-side">
            <div class="filters">
              <select id="f-carrier" aria-label="선사"><option value="">전체 선사</option>${carriers.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
              <select id="f-status" aria-label="확인 상태">
                <option value="">전체 상태</option><option value="gold">사람 확인한 공지</option><option value="ai">사람 확인 전 공지</option>
                <option value="review">확인 요청 있는 공지</option><option value="none">할증 없는 공지</option>
              </select>
              <input id="f-q" type="search" placeholder="제목, 약어 검색(예: EBS, 호르무즈)" aria-label="검색">
              <p class="count" id="f-count" aria-live="polite"></p>
            </div>
            <ul class="nlist" id="nlist"></ul>
          </div>
          <div class="inbox-main" id="ndetail"></div>
        </div>`;
      const upd = () => { S.inbox = { carrier: $('#f-carrier').value, status: $('#f-status').value, q: $('#f-q').value.trim().toLowerCase() }; renderList(); };
      ['change', 'input'].forEach((e) => { $('#f-carrier').addEventListener(e, upd); $('#f-status').addEventListener(e, upd); $('#f-q').addEventListener(e, upd); });
      $('#nlist').addEventListener('click', (e) => { const b = e.target.closest('button[data-nid]'); if (b) location.hash = noticeHref(b.dataset.nid); });
      renderList();
    }
    const sel = args[0] && S.db.notices[args[0]] ? args[0] : null;
    $('.inbox').classList.toggle('detail', !!sel);
    $$('#nlist button').forEach((b) => b.setAttribute('aria-current', b.dataset.nid === (sel || defaultNotice()) ? 'true' : 'false'));
    renderDetail(sel || defaultNotice(), args[1], !!sel);
  }
  function defaultNotice() { return 'cmacgm_adv02'; }
  function filteredNotices() {
    const f = S.inbox;
    return Object.entries(S.db.notices).filter(([nid, n]) => {
      if (f.carrier && n.carrier !== f.carrier) return false;
      if (f.status === 'gold' && !n.human) return false;
      if (f.status === 'ai' && n.human) return false;
      if (f.status === 'none' && n.records) return false;
      if (f.status === 'review' && !S.db.records.some((r) => r.notice_id === nid && r.ai === 'ai_review')) return false;
      if (f.q) {
        const hay = (n.title + ' ' + n.carrier + ' ' + S.db.records.filter((r) => r.notice_id === nid).map((r) => recLabel(r) + ' ' + (r.evidence || []).join(' ')).join(' ')).toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    }).sort((a, b) => (b[1].published_date || '').localeCompare(a[1].published_date || ''));
  }
  function renderList() {
    const list = filteredNotices();
    $('#f-count').textContent = `공지 ${list.length}건`;
    const cur = location.hash.split('/')[1];
    $('#nlist').innerHTML = list.length ? list.map(([nid, n]) => {
      const { c } = noticeStats(nid);
      const tags = [n.human ? chip('ok', '사람 확인') : n.labeled ? chip('warn', 'Claude 정답, 확인 전') : chip('warn', 'AI, 확인 전'), n.records ? chip('plain', `요금 ${n.records}개`) : chip('plain', '할증 없음')];
      if (c.ai_review) tags.push(chip('warn', `확인 요청 ${c.ai_review}`));
      return `<li><button data-nid="${esc(nid)}" aria-current="${cur && decodeURIComponent(cur) === nid}">
        <span class="nl-meta"><span>${esc(n.carrier)}</span><span>${n.published_date ? esc(n.published_date) : '게시일 없음'}</span></span>
        <span class="nl-title">${esc(n.title || nid)}</span><span class="nl-tags">${tags.join('')}</span></button></li>`;
    }).join('') : '<li class="empty">조건에 맞는 공지가 없습니다. 필터를 바꿔 보세요.</li>';
  }
  function renderDetail(nid, openIdx, fromList) {
    const n = S.db.notices[nid];
    const { recs, c } = noticeStats(nid);
    let sum;
    if (!recs.length) sum = '할증·요금이 없는 공지입니다(운영 안내). AI가 여기서 할증을 지어내지 않는지 확인하는 사례로 썼습니다.';
    else if (n.labeled) sum = `${n.human ? '사람이 원문과 대조해 확인한' : 'Claude가 만든 정답 라벨(dev, 사람 확인 전)의'} 할증·요금 ${recs.length}개. AI 추출(Claude Sonnet)과 비교하면 그대로 맞은 것 ${(c.auto || 0) + (c.reviewed || 0)}개(검사기 자동 승인 ${c.auto || 0}, 사람 확인으로 보냄 ${c.reviewed || 0}), 다르거나 빠진 것 ${c.corrected || 0}개.`;
    else {
      const reasons = {};
      recs.filter((r) => r.ai === 'ai_review').forEach((r) => (r.ai_reasons || []).forEach((x) => { reasons[x] = (reasons[x] || 0) + 1; }));
      const rs = Object.entries(reasons).map(([k, v]) => `${REASON[k] || k} ${v}`).join(', ');
      sum = `AI가 뽑은 할증·요금 ${recs.length}개, 사람 확인 전. 검사기 자동 승인 ${c.ai_auto || 0}개, 확인 요청 ${c.ai_review || 0}개${rs ? `(${rs})` : ''}.`;
    }
    $('#ndetail').innerHTML = `
      <a class="btn small back" href="#notices">목록으로</a>
      <div class="nd-head">
        <div class="nd-meta"><span><b>${esc(n.carrier)}</b></span><span>${esc(KIND[n.notice_kind] || '')} 공지</span><span>게시 ${n.published_date ? esc(n.published_date) + ' ' + kd(n.published_date).slice(-3) : '날짜 없음'}</span><a href="${esc(n.url)}" target="_blank" rel="noopener">원문 열기</a></div>
        <h2>${esc(n.title || nid)}</h2>
      </div>
      <p class="nd-sum">${esc(sum)}</p>
      ${recs.length ? `<div class="tbl-wrap"><table>
        <thead><tr><th>할증</th><th class="r">금액</th><th>대상</th><th>범위</th><th>시작</th><th>상태</th></tr></thead>
        <tbody>${recs.map((r) => recRow(r)).join('')}</tbody></table></div>` : ''}`;
    $$('#ndetail tr.rec').forEach((tr) => {
      tr.tabIndex = 0;
      const toggle = () => toggleRec(tr);
      tr.addEventListener('click', toggle);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
    if (openIdx != null) {
      const tr = $(`#ndetail tr.rec[data-i="${CSS.escape(String(openIdx))}"]`);
      if (tr) { toggleRec(tr); tr.classList.add('hit'); tr.scrollIntoView({ block: 'center' }); }
    } else if (fromList && window.innerWidth <= 1000) $('#ndetail').scrollIntoView();
  }
  function scopeText(r) {
    const o = r.origin_scope_as_written, d = r.destination_scope_as_written;
    if (r.direction_norm === 'from_or_to') return o || d || '';
    return [o, d].filter(Boolean).join(' → ');
  }
  function recRow(r) {
    const sc = scopeText(r);
    return `<tr class="rec" data-i="${esc(recIdx(r))}" aria-expanded="false">
      <td>${esc(recLabel(r))}${r.code_as_written && r.name_as_written ? `<span class="nm">${esc(r.name_as_written)}</span>` : ''}</td>
      <td class="r num">${esc(money(r.currency, r.amount))}<span class="nm">${esc(UNIT[r.unit] || r.unit)}</span></td>
      <td>${esc(SIZE[r.container_size] || r.container_size)} ${esc(TYPE[r.container_type] || r.container_type)}</td>
      <td><span class="nm" style="color:var(--ink-2)">${esc(DIR[r.direction_norm] || '')}</span>${esc(sc.length > 70 ? sc.slice(0, 68) + '…' : sc)}</td>
      <td class="num">${esc(r.effective_from || '—')}<span class="nm">${esc(BASIS[r.basis_rule] || '')} 기준</span></td>
      <td>${recChip(r)}</td></tr>`;
  }
  function toggleRec(tr) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains('recx')) { next.remove(); tr.classList.remove('open'); tr.setAttribute('aria-expanded', 'false'); return; }
    const nid = location.hash.split('/')[1] ? decodeURIComponent(location.hash.split('/')[1]) : defaultNotice();
    const r = S.db.records.find((x) => x.notice_id === nid && recIdx(x) === tr.dataset.i);
    if (!r) return;
    const kv = [
      ['원문 표기', [r.code_as_written, r.name_as_written].filter(Boolean).join(' / ')],
      ['분류', CAT[r.category] || r.category],
      ['범위 원문', scopeText(r)],
      ['항만', (r.ports_as_written || []).join(', ')],
      ['시작 원문', r.effective_from_text],
      ['종료', [r.effective_to, r.effective_to_text].filter(Boolean).join(' · ')],
      ['기준일', [BASIS[r.basis_rule], r.basis_text].filter(Boolean).join(': ')],
      ['청구 위치', PAY[r.payment_location]],
      ['조건', (r.conditions || []).map(condText).join(', ')],
      ['검사기', r.ai_reasons ? (r.ai_reasons.length ? r.ai_reasons.map((x) => REASON[x] || x).join(', ') : '통과') : ''],
      ['상태 설명', (VERIFIED.includes(r.ai) && !r.human ? 'Claude가 만든 정답 라벨(dev, 사람 확인 전). ' : '') + ((AI[r.ai] || [])[2] || '')],
    ].filter(([, v]) => v);
    const x = document.createElement('tr');
    x.className = 'recx';
    x.innerHTML = `<td colspan="6"><div class="recx-grid">
      <div><p class="small muted" style="margin:8px 0 6px">근거 구절(공지 원문 그대로)</p><ul class="ev">${(r.evidence || []).map((e) => `<li>${highlight(e, r)}</li>`).join('')}</ul></div>
      <dl class="kv" style="margin-top:8px">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div></td>`;
    tr.after(x); tr.classList.add('open'); tr.setAttribute('aria-expanded', 'true');
  }

  // ---------- 계산기 ----------
  const PRESETS = [
    { name: '중동 4개 선사 비교', v: { carrier: '*', origin: 'KRPUS', destination: 'AEJEA', size: '40', type: 'dry', qty: 1, booking: '2026-03-27', etd: '2026-04-10', scope: 'ocean', verifiedOnly: false, asof: '' } },
    { name: '견적 때 몰랐던 할증', v: { carrier: 'CMA CGM', origin: 'KRPUS', destination: 'AEJEA', size: '40', type: 'dry', qty: 1, booking: '2026-02-27', etd: '2026-03-13', scope: 'ocean', verifiedOnly: false, asof: '2026-02-27' } },
    { name: '동남아 20피트 3개', v: { carrier: '장금상선', origin: 'KRPUS', destination: 'VNHPH', size: '20', type: 'dry', qty: 3, booking: '2026-04-28', etd: '2026-05-10', scope: 'all', verifiedOnly: false, asof: '' } },
    { name: '한일 구간', v: { carrier: '흥아라인', origin: 'KRPUS', destination: 'JPOSA', size: '40', type: 'dry', qty: 1, booking: '2026-09-25', etd: '2026-10-05', scope: 'all', verifiedOnly: false, asof: '' } },
  ];
  function viewCalc() {
    const el = $('#view-calc');
    if (el.dataset.ready) return;
    el.dataset.ready = 1;
    const carriers = CARRIER_ORDER.filter((c) => S.db.records.some((r) => r.carrier === c));
    const ports = Geo.PORTS.map(([code, ko]) => [code, ko]);
    const kr = ports.filter(([c]) => c.startsWith('KR')), other = ports.filter(([c]) => !c.startsWith('KR')).sort((a, b) => a[1].localeCompare(b[1], 'ko'));
    const portOpts = [...kr, ...other].map(([c, ko]) => `<option value="${c}">${esc(ko)} (${c})</option>`).join('');
    el.innerHTML = `
      <div class="view-head"><h1>내 화물 계산기</h1><p>화물 조건을 넣으면 수집한 공지 중 이 화물에 붙는 할증과 합계를 냅니다. 공지에 없는 판단을 추정한 곳은 '확인할 것'에 적습니다.</p></div>
      <div class="presets" role="group" aria-label="예시">${PRESETS.map((p, i) => `<button class="btn small" type="button" data-p="${i}">${esc(p.name)}</button>`).join('')}</div>
      <div class="calc">
        <form class="cform" id="cform" autocomplete="off">
          <div class="field"><label for="c-carrier">선사</label><select id="c-carrier" name="carrier"><option value="*">전체 비교</option>${carriers.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
          <div class="row2 field">
            <div><label for="c-origin">출발항</label><select id="c-origin" name="origin">${portOpts}</select></div>
            <div><label for="c-destination">도착항</label><select id="c-destination" name="destination">${portOpts}</select></div>
          </div>
          <div class="row2 field">
            <div><label for="c-size">크기</label><select id="c-size" name="size"><option value="20">20'</option><option value="40">40'</option><option value="40HC">40' HC</option><option value="45">45'</option></select></div>
            <div><label for="c-type">타입</label><select id="c-type" name="type"><option value="dry">일반(Dry)</option><option value="reefer">냉동(Reefer)</option><option value="special">특수(Open Top 등)</option><option value="dg">위험물</option></select></div>
          </div>
          <div class="row2 field">
            <div><label for="c-qty">수량</label><input id="c-qty" name="qty" type="number" min="1" max="999" inputmode="numeric"></div>
            <div><label for="c-scope">할증 범위</label><select id="c-scope" name="scope"><option value="ocean">해상 할증만</option><option value="all">항만·현지 비용 포함</option></select></div>
          </div>
          <div class="row2 field">
            <div><label for="c-booking">부킹일</label><input id="c-booking" name="booking" type="date"></div>
            <div><label for="c-etd">출항일(ETD)</label><input id="c-etd" name="etd" type="date"></div>
          </div>
          <div class="field">
            <label for="c-asof">견적 시점으로 보기</label><input id="c-asof" name="asof" type="date">
            <p class="hint">날짜를 넣으면 그날까지 게시된 공지만으로 계산하고, 출항 때 실제 합계와 비교합니다.</p>
          </div>
          <label class="check"><input type="checkbox" name="verifiedOnly" id="c-ver"><span>사람이 확인한 공지만 쓰기<small>사람 확인 전 46건(Claude 정답 11, AI 추출 35)을 뺍니다</small></span></label>
        </form>
        <div class="cres" id="cres" aria-live="polite"></div>
      </div>`;
    const form = $('#cform');
    const set = (v) => { Object.entries(v).forEach(([k, val]) => { const f = form.elements[k]; if (!f) return; if (f.type === 'checkbox') f.checked = !!val; else f.value = val; }); calcRun(); };
    $$('.presets button', el).forEach((b) => b.addEventListener('click', () => set(PRESETS[+b.dataset.p].v)));
    form.addEventListener('input', calcRun);
    form.addEventListener('change', calcRun);
    form.addEventListener('submit', (e) => e.preventDefault());
    set(PRESETS[0].v);
  }
  function readForm() {
    const f = $('#cform').elements;
    return { carrier: f.carrier.value, origin: f.origin.value, destination: f.destination.value, size: f.size.value, type: f.type.value,
      qty: Math.max(1, Math.min(999, parseInt(f.qty.value, 10) || 1)), booking: f.booking.value || undefined, etd: f.etd.value,
      scope: f.scope.value, verifiedOnly: f.verifiedOnly.checked, asof: f.asof.value };
  }
  function shipOf(v) {
    return { carrier: v.carrier, origin: v.origin, destination: v.destination, size: v.size, type: v.type, qty: v.qty, booking: v.booking, etd: v.etd,
      includeLocal: v.scope === 'all', categories: v.scope === 'ocean' ? OCEAN : undefined, verifiedOnly: v.verifiedOnly };
  }
  function dbAsOf(asof) {
    if (!asof) return S.db;
    const ok = new Set(Object.entries(S.db.notices).filter(([, n]) => n.published_date && n.published_date <= asof).map(([k]) => k));
    return { notices: S.db.notices, records: S.db.records.filter((r) => ok.has(r.notice_id)) };
  }
  const totalText = (t, hasLines) => (t ? Object.entries(t).map(([cur, m]) => (m.min === m.max ? money(cur, m.min) : `${cur} ${fmt(m.min)}~${fmt(m.max)}`)).join(' + ') : hasLines ? '금액 미정' : '0');
  function calcText(l, ship) {
    const r = l.r;
    if (r.amount == null) return '공지에 금액 없음';
    const q = ship.qty;
    if (r.unit === 'per_teu') return `${money(r.currency, r.amount)} × ${Calc.TEU[ship.size]}TEU${q > 1 ? ` × ${q}개` : ''}`;
    if (r.unit === 'per_container') return `${money(r.currency, r.amount)}${q > 1 ? ` × ${q}개` : ''}`;
    if (r.unit === 'per_bl') return `${money(r.currency, r.amount)} (B/L당)`;
    if (r.unit === 'percent_of_base') return `운임의 ${fmt(r.amount)}%`;
    return `${money(r.currency, r.amount)} (${UNIT[r.unit] || r.unit})`;
  }
  // 확인할 것: 판단을 바꿀 수 있는 것을 앞에, 나머지는 접어 둔다
  const FLAG_RANK = [/AI 추출/, /금액이 없음|기준 운임/, /기존 부킹|화물 상태/, /운임에 포함/, /규제 승인/, /계약/, /적용일이 다름/, /후보/, /제외|범위가 없음/];
  function flagList(flags) {
    if (!flags.length) return '<span class="muted small">없음</span>';
    const rank = (f) => { const i = FLAG_RANK.findIndex((re) => re.test(f)); return i < 0 ? 99 : i; };
    const fs = [...flags].sort((a, b) => rank(a) - rank(b));
    const top = fs.slice(0, 2), rest = fs.slice(2);
    return `<ul class="flagl">${top.map((f) => `<li>${esc(f)}</li>`).join('')}${rest.length ? `<li style="padding:0"><details><summary>나머지 ${rest.length}개 보기</summary><ul>${rest.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details></li>` : ''}</ul>`;
  }
  const LSTAT = { applied: null, alternative: ['plain', '후보', '방향 구분이 공지에 없어 후보 중 하나. 합계는 범위로'], included: ['plain', '운임 포함', '공지상 운임에 포함. 합계에서 뺌'], no_total: ['warn', '금액 미정', '합계에서 뺌'] };
  function calcRun() {
    const v = readForm();
    const out = $('#cres');
    if (!v.etd) { out.innerHTML = '<div class="empty">출항일을 넣어 주세요.</div>'; return; }
    if (v.origin === v.destination) { out.innerHTML = '<div class="empty">출발항과 도착항이 같습니다. 도착항을 바꿔 주세요.</div>'; return; }
    const ship = shipOf(v);
    const t0 = performance.now();
    const res = Calc.calculate(dbAsOf(v.asof), ship, Geo);
    const ms = performance.now() - t0;
    const actual = v.asof ? Calc.calculate(S.db, ship, Geo) : null;
    const carriers = v.carrier === '*' ? CARRIER_ORDER : [v.carrier];
    const by = (c, list) => list.filter((l) => l.r.carrier === c);
    const shown = carriers.filter((c) => by(c, res.lines).length || (actual && by(c, actual.lines).length));
    const horizon = addDays(v.booking && v.etd > v.booking ? v.etd : v.etd, 30);
    const upcoming = res.upcoming.filter((l) => !l.sortDate || l.sortDate <= horizon);
    let html = `<div class="cres-head"><h2>${esc(Geo.portName[v.origin])} → ${esc(Geo.portName[v.destination])}, ${esc(SIZE[v.size])} ${esc(TYPE[v.type])} ${v.qty}개, ${kd(v.etd)} 출항</h2>
      <span class="small muted">계산 ${ms < 1 ? ms.toFixed(2) : ms.toFixed(1)}ms, 공지 ${v.asof ? `${v.asof}까지 게시된 것만` : '전체'}${v.verifiedOnly ? ', 사람 확인한 것만' : ''}</span></div>`;
    if (actual) {
      const rows = carriers.filter((c) => res.totals[c] || actual.totals[c]).map((c) => {
        const known = new Set(by(c, res.lines).map((l) => l.r.id));
        const miss = by(c, actual.lines).filter((l) => !known.has(l.r.id) && l.status !== 'included');
        return `<tr><td>${esc(c)}</td><td class="r num">${esc(totalText(res.totals[c]))}</td><td class="r num"><b>${esc(totalText(actual.totals[c]))}</b></td>
          <td>${miss.length ? miss.map((l) => `<a href="${noticeHref(l.r.notice_id, recIdx(l.r))}">${esc(recLabel(l.r))}</a> ${esc(calcText(l, ship))}, ${kd(l.notice.published_date)} 게시`).join('<br>') : '없음'}</td></tr>`;
      });
      html += `<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>견적 때 알 수 있던 것과 출항 때 실제</h2></div>
        <p>${kd(v.asof)}까지 게시된 공지로 낸 합계와, 출항 때 붙는 합계입니다. 미래 공지는 어떤 도구도 미리 알 수 없습니다. 이 차이를 빨리 알아채고 영향받는 부킹을 찾는 것이 이 도구의 역할입니다.</p>
        <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>선사</th><th class="r">견적 시점</th><th class="r">출항 때 실제</th><th>견적 뒤 게시된 할증</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="4">차이 없음</td></tr>'}</tbody></table></div></div>`;
    }
    if (v.carrier === '*' && shown.length > 1) {
      html += `<div class="cmp">${shown.map((c) => `<div><span>${esc(c)}</span><b class="num">${esc(totalText(res.totals[c], by(c, res.lines).length))}</b><span>할증 ${by(c, res.lines).length}개</span></div>`).join('')}</div>`;
    }
    if (!shown.length) {
      html += `<div class="carrier"><div class="empty">이 조건에 붙는 할증을 수집한 공지에서 찾지 못했습니다. 선사 7곳, 공지 80건만 담겨 있어서 없는 게 아니라 모르는 것일 수 있습니다.${v.asof ? ' 견적 시점 날짜를 지우면 전체 공지로 계산합니다.' : ''}</div></div>`;
    }
    shown.forEach((c) => {
      const lines = by(c, res.lines).sort((a, b) => (a.status === 'applied' ? 0 : 1) - (b.status === 'applied' ? 0 : 1));
      html += `<section class="carrier"><div class="carrier-h"><h3>${esc(c)}</h3><span class="total num">${esc(totalText(res.totals[c], lines.length))}<small>합계${res.totals[c] && lines.some((l) => l.total == null) ? ', 금액 미정 할증 제외' : ''}</small></span></div>`;
      if (lines.length) {
        html += `<div class="tbl-wrap" style="border:0;border-radius:0"><table class="lines"><thead><tr><th>할증</th><th>계산</th><th class="r">금액</th><th>근거 공지</th><th>확인할 것</th></tr></thead><tbody>${lines.map((l) => {
          const st = LSTAT[l.status];
          const flags = l.flags.filter((f) => !/^방향\(Headhaul/.test(f) || l.status !== 'alternative');
          return `<tr><td>${esc(recLabel(l.r))}${st ? ' ' + chip(st[0], st[1], st[2]) : ''}<span class="nm">${esc(CAT[l.r.category] || '')}</span></td>
            <td class="num">${esc(calcText(l, ship))}</td><td class="r num"><b>${l.total == null ? '—' : esc(money(l.r.currency, l.total))}</b></td>
            <td><a href="${noticeHref(l.r.notice_id, recIdx(l.r))}">${esc((l.notice.title || '').slice(0, 48))}${(l.notice.title || '').length > 48 ? '…' : ''}</a><span class="nm">${esc(l.notice.published_date || '')} 게시, ${esc(l.r.effective_from || '시작일 없음')}부터 · <a href="${esc(l.notice.url)}" target="_blank" rel="noopener">원문</a></span></td>
            <td>${flagList(flags)}</td></tr>`;
        }).join('')}</tbody></table></div>`;
      } else html += '<div class="empty">이 조건에서 붙는 할증 없음</div>';
      const up = by(c, upcoming), ex = res.excluded.filter((x) => x.r.carrier === c);
      if (up.length) html += `<details class="sub"><summary>출항일 뒤 30일 안에 시작하는 할증 ${up.length}개(출항이 늦어지면 붙을 수 있음)</summary><ul>${up.map((l) => `<li>${esc(recLabel(l.r))} ${esc(calcText(l, ship))}, ${esc(l.sortDate || l.notice.published_date || '')}부터 <a href="${noticeHref(l.r.notice_id, recIdx(l.r))}">근거</a></li>`).join('')}</ul></details>`;
      if (ex.length) html += `<details class="sub"><summary>범위에서 빠진 할증 ${ex.length}개</summary><ul>${ex.map((x) => `<li>${esc(recLabel(x.r))} ${esc(money(x.r.currency, x.r.amount))}: ${esc(x.reason)} <a href="${noticeHref(x.r.notice_id, recIdx(x.r))}">근거</a></li>`).join('')}</ul></details>`;
      html += '</section>';
    });
    out.innerHTML = html;
  }

  // ---------- 타임라인 ----------
  function viewTimeline(args, changed) {
    const el = $('#view-timeline');
    if (!el.dataset.ready) {
      el.dataset.ready = 1;
      const sc = S.sc, sm = sc.summary, ev = sc.events;
      const weeklyDelay = ev.reduce((a, e) => a + diffDays(e.weekly_aware, e.published), 0) / ev.length;
      const retro = ev.filter((e) => e.effective_from && e.effective_from < e.published).length;
      const nostart = ev.filter((e) => !e.effective_from).length;
      const late = sm.events_after_effective_weekly;
      const sp = sm.surprise;
      el.innerHTML = `
        <div class="view-head"><h1>할증 타임라인: 2026년 중동 사태 재현</h1>
          <p>부산 → 제벨알리 40' Dry 1개를 견적 2주 뒤 출항으로 계속 견적했다고 가정하고, 수집한 공지(Maersk, MSC, CMA CGM, ONE)만으로 언제 무엇이 붙었는지 다시 계산했습니다. 해상 할증만 봅니다.</p></div>
        <div class="facts">
          <p>이 화물에 붙은 할증 공지 <b>${ev.length}건</b>. 게시에서 적용까지 간격은 중앙값 <b>${sm.median_lead_days}일</b>입니다. <b>${retro}건</b>은 게시일보다 앞선 날짜로 소급됐고, <b>${nostart}건</b>은 시작일 없이 이미 받은 부킹에 붙었습니다.</p>
          <p>매주 월요일에 확인하면 게시 후 평균 <b>${weeklyDelay.toFixed(1)}일</b> 뒤에 알고, <b>${late}건</b>은 적용이 시작된 뒤에 압니다. 매일 수집하면 지연은 하루로 줄지만 이 ${late}건은 여전히 늦습니다. 그때 남는 일은 영향받는 부킹을 빨리 찾는 것입니다.</p>
          <p>견적 뒤 새 할증이 생긴 견적일: CMA CGM <b>${sp['CMA CGM'].quotes_with_new_charge}/${sp['CMA CGM'].quotes}일</b>, Maersk <b>${sp.Maersk.quotes_with_new_charge}일</b>, MSC <b>${sp.MSC.quotes_with_new_charge}일</b>. 최대 40' 1개당 USD <b>${fmt(Math.max(...Object.values(sp).map((x) => x.max_new_charge)))}</b>.</p>
        </div>
        <div class="panel"><div class="panel-h"><h2>KCCI 중동항로 지수와 할증 공지</h2><span class="small muted">KCCI 주간, 한국해양진흥공사</span></div>
          <p>위는 KCCI 중동항로(KMEI) 주간 지수, 아래는 선사별 할증 공지입니다. 빈 원이 게시일, 채운 원이 적용일입니다. 점선은 매주 월요일(주 1회 확인 가정)입니다.</p>
          <div class="chart" id="ch-lanes"></div></div>
        <div class="panel"><div class="panel-h"><h2>출항일별로 이 화물에 붙는 할증 합계</h2><span class="small muted">USD, 40' Dry 1개, 견적 2주 뒤 출항</span></div>
          <p>모든 공지를 아는 상태에서 계산한 사후 합계입니다. 금액이 갈리는 곳(Headhaul/Backhaul)은 큰 값으로 그렸습니다. Maersk 긴급운임(USD 3,000)과 MSC 항해 종료 할증(USD 800)은 시작일 없이 '기존 부킹·운항 중 화물'에 매긴 요금이라, 게시 때 이미 있던 부킹에만 붙인다고 해석했습니다. 그래서 일정 출항일 뒤로는 빠집니다(해석, 확인 필요).</p>
          <div class="legend" id="lg-curve"></div><div class="chart" id="ch-curve"></div></div>
        <div class="panel"><div class="panel-h"><h2>공지 ${ev.length}건: 게시, 적용, 알아차리는 날</h2></div>
          <div class="tbl-wrap" style="margin-top:10px"><table>
            <thead><tr><th>게시</th><th>적용</th><th class="r">간격</th><th>선사</th><th>할증</th><th class="r">40' 1개</th><th>매일 확인(다음 날)</th><th>주 1회 확인(월요일)</th><th>데이터</th></tr></thead>
            <tbody>${ev.map((e) => `<tr><td class="num">${kd(e.published)}</td><td class="num">${e.effective_from ? kd(e.effective_from) : '게시일'}</td><td class="r num">${e.lead_days}일</td>
              <td><span class="dot" style="background:${SERIES[e.carrier]}"></span>${esc(e.carrier)}</td>
              <td><a href="${noticeHref(e.notice_id)}">${esc(e.code)}</a></td><td class="r num">${e.amount_40 == null ? '금액 없음' : esc(money(e.currency, e.amount_40))}${e.status === 'alternative' ? '<span class="nm">후보 중 하나</span>' : ''}</td>
              <td>${margin(e.daily_margin)}</td><td>${margin(e.weekly_margin)}</td><td>${recChip(e)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="panel"><div class="panel-h"><h2>읽을 때 주의할 점</h2></div>
          <ul class="flagl" style="font-size:15px">
            <li>미래 공지는 어떤 도구도 미리 알 수 없습니다. 도구가 줄이는 것은 게시 후 알아차리기까지의 시간과, 영향받는 기존 부킹을 찾는 시간입니다.</li>
            <li>선사 4곳, 화물 1종, 수집한 공지만으로 계산했습니다. HMM, Hapag-Lloyd 등은 빠져 있습니다.</li>
            <li>'주 1회 월요일 확인', '견적 후 14일 출항'은 가정입니다. 실무자 확인 전입니다.</li>
            <li>KMEI는 지수 값입니다. 지수 단위와 할증 포함 여부는 KCCI 산출 기준을 확인하는 중이라 할증 금액과 직접 비교하지 않습니다.</li>
          </ul></div>`;
      $('#lg-curve').innerHTML = S.sc.carriers.map((c) => `<span><span class="dot" style="background:${SERIES[c]}"></span>${esc(c)}</span>`).join('');
    }
    drawTimeline();
  }
  function margin(m) {
    if (m > 0) return `<span class="num">적용 ${m}일 전</span>`;
    if (m === 0) return '<span class="num">적용 당일</span>';
    return chip('late', `적용 ${-m}일 뒤`);
  }
  const SHORT = { 'Emergency Freight rate': '긴급운임', 'mandatory surcharge': '항해 종료 할증' };
  const NS = 'http://www.w3.org/2000/svg';
  function svg(w, h) { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', `0 0 ${w} ${h}`); s.setAttribute('width', w); s.setAttribute('height', h); return s; }
  function add(p, tag, attrs, text) { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text != null) e.textContent = text; p.appendChild(e); return e; }
  function niceMax(v, step) { return Math.ceil(v / step) * step; }

  function drawTimeline() {
    const box = $('#ch-lanes');
    if (!box || box.offsetParent === null) return;
    const W = box.clientWidth;
    if (S.drawn.w === W) return;
    S.drawn.w = W;
    drawLanes(box, W);
    drawCurve($('#ch-curve'), W);
  }
  function drawLanes(box, W) {
    const sc = S.sc, carriers = sc.carriers;
    const narrow = W < 640;
    const x0 = narrow ? '2026-02-09' : '2026-01-05', x1 = narrow ? '2026-05-11' : '2026-06-29';
    const L = narrow ? 64 : 76, R = 14, topH = narrow ? 160 : 190, laneH = 46, gap = 26;
    const H = topH + gap + carriers.length * laneH + 28;
    const span = diffDays(x1, x0);
    const X = (d) => L + (W - L - R) * diffDays(d, x0) / span;
    const k = sc.kmei.filter((p) => p.date >= x0 && p.date <= x1);
    const yMax = niceMax(Math.max(...k.map((p) => p.v)) * 1.05, 2000);
    const Y = (v) => 10 + (topH - 20) * (1 - v / yMax);
    const s = svg(W, H);
    for (let v = 0; v <= yMax; v += 2000) {
      add(s, 'line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' });
      add(s, 'text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end' }, fmt(v));
    }
    add(s, 'text', { x: L, y: 4, class: 'lbl', 'dominant-baseline': 'hanging', dx: 6 }, 'KMEI');
    // 월요일 점선(차선 영역), 월 눈금
    const laneTop = topH + gap - 8, laneBot = H - 26;
    for (let d = x0; d <= x1; d = addDays(d, 7)) add(s, 'line', { x1: X(d), x2: X(d), y1: laneTop, y2: laneBot, class: 'mon' });
    for (let m = 1; m <= 6; m++) {
      const d = `2026-0${m}-01`;
      if (d < x0 || d > x1) continue;
      add(s, 'line', { x1: X(d), x2: X(d), y1: laneBot, y2: laneBot + 5, class: 'axis' });
      add(s, 'text', { x: X(d), y: H - 6, 'text-anchor': 'middle' }, `${m}월`);
    }
    add(s, 'line', { x1: L, x2: W - R, y1: laneBot, y2: laneBot, class: 'axis' });
    // KMEI 선
    add(s, 'path', { d: k.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.v).toFixed(1)}`).join(''), fill: 'none', stroke: 'var(--kmei)', 'stroke-width': 2, 'stroke-linejoin': 'round' });
    // 차선
    const evs = sc.events;
    carriers.forEach((c, i) => {
      const yc = topH + gap + i * laneH + laneH / 2;
      add(s, 'text', { x: L - 10, y: yc + 4, 'text-anchor': 'end', class: 'lbl' }, c);
      let lastLabelEnd = -1e9;
      evs.filter((e) => e.carrier === c).sort((a, b) => a.published.localeCompare(b.published)).forEach((e) => {
        const eff = e.effective_from || e.published;
        const xp = X(e.published), xe = X(eff);
        const late = e.weekly_margin < 0;
        add(s, 'line', { x1: Math.min(xp, xe), x2: Math.max(xp, xe), y1: yc, y2: yc, stroke: xe < xp ? 'var(--late)' : SERIES[c], 'stroke-width': 3, 'stroke-dasharray': xe < xp ? '3 3' : 'none' });
        add(s, 'circle', { cx: xp, cy: yc, r: 5, fill: 'var(--surface)', stroke: SERIES[c], 'stroke-width': 2 });
        add(s, 'circle', { cx: xe, cy: yc, r: 5, fill: SERIES[c], stroke: late ? 'var(--late)' : 'var(--surface)', 'stroke-width': late ? 2.5 : 2 });
        const label = SHORT[e.code] || e.code;
        const lx = Math.min(xp, xe), above = lx > lastLabelEnd + 4;
        const t = add(s, 'text', { x: lx, y: above ? yc - 10 : yc + 18, class: 'lbl', style: late ? 'fill:var(--late)' : '' }, label + (late ? ' 늦음' : ''));
        if (above) lastLabelEnd = lx + (label.length + (late ? 3 : 0)) * 7.5;
        const hit = add(s, 'rect', { x: Math.min(xp, xe) - 8, y: yc - 14, width: Math.abs(xe - xp) + 16, height: 28, fill: 'transparent', tabindex: 0, role: 'img',
          'aria-label': `${c} ${e.code}, ${e.published} 게시, ${eff} 적용` });
        const html = `<b>${esc(c)} ${esc(e.code)}</b><br>게시 ${kd(e.published)}, 적용 ${e.effective_from ? kd(e.effective_from) : '게시일부터'}<br>40' 1개 ${e.amount_40 == null ? '금액 없음' : esc(money(e.currency, e.amount_40))}<br>주 1회 확인 시 ${kd(e.weekly_aware)}에 앎${late ? ` (적용 ${-e.weekly_margin}일 뒤)` : ''}`;
        hit.addEventListener('mousemove', (ev) => showTip(html, ev.clientX, ev.clientY));
        hit.addEventListener('mouseleave', hideTip);
        hit.addEventListener('focus', () => { const r = hit.getBoundingClientRect(); showTip(html, r.right, r.top); });
        hit.addEventListener('blur', hideTip);
        hit.addEventListener('click', () => { location.hash = noticeHref(e.notice_id); });
        void t;
      });
    });
    // KMEI 십자선
    const xh = add(s, 'line', { y1: 10, y2: topH - 10, class: 'xh', visibility: 'hidden' });
    const ov = add(s, 'rect', { x: L, y: 0, width: W - L - R, height: topH, fill: 'transparent' });
    ov.addEventListener('mousemove', (ev) => {
      const r = s.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width);
      const p = k.reduce((a, b) => (Math.abs(X(b.date) - px) < Math.abs(X(a.date) - px) ? b : a));
      xh.setAttribute('x1', X(p.date)); xh.setAttribute('x2', X(p.date)); xh.setAttribute('visibility', 'visible');
      showTip(`<b>${p.date} 주</b><br>KMEI ${fmt(p.v)}`, ev.clientX, ev.clientY);
    });
    ov.addEventListener('mouseleave', () => { xh.setAttribute('visibility', 'hidden'); hideTip(); });
    box.replaceChildren(s);
  }
  function drawCurve(box, W) {
    const sc = S.sc, cs = sc.carriers, data = sc.curve;
    const L = 48, R = W < 560 ? 104 : 112, T = 12, B = 28, H = W < 560 ? 260 : 300;
    const x0 = data[0].etd, x1 = data[data.length - 1].etd, span = diffDays(x1, x0);
    const X = (d) => L + (W - L - R) * diffDays(d, x0) / span;
    const yMax = niceMax(Math.max(...data.flatMap((p) => cs.map((c) => p[c]))) * 1.08, 1000);
    const Y = (v) => T + (H - T - B) * (1 - v / yMax);
    const s = svg(W, H);
    for (let v = 0; v <= yMax; v += 1000) {
      add(s, 'line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'grid' });
      add(s, 'text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end' }, fmt(v));
    }
    ['2026-03-01', '2026-04-01', '2026-05-01'].forEach((d) => add(s, 'text', { x: X(d), y: H - 8, 'text-anchor': 'middle' }, `${+d.slice(5, 7)}월`));
    add(s, 'line', { x1: L, x2: W - R, y1: Y(0), y2: Y(0), class: 'axis' });
    const ends = [];
    cs.forEach((c) => {
      let d = '';
      data.forEach((p, i) => { const x = X(p.etd).toFixed(1), y = Y(p[c]).toFixed(1); d += i ? `H${x}V${y}` : `M${x},${y}`; });
      add(s, 'path', { d, fill: 'none', stroke: SERIES[c], 'stroke-width': 2, 'stroke-linejoin': 'round' });
      ends.push({ c, y: Y(data[data.length - 1][c]), v: data[data.length - 1][c] });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach((e) => add(s, 'text', { x: W - R + 6, y: e.y + 4, class: 'lbl' }, `${e.c} ${fmt(e.v)}`));
    const xh = add(s, 'line', { y1: T, y2: H - B, class: 'xh', visibility: 'hidden' });
    const ov = add(s, 'rect', { x: L, y: 0, width: W - L - R, height: H - B, fill: 'transparent' });
    ov.addEventListener('mousemove', (ev) => {
      const r = s.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(data.length - 1, Math.round((px - L) / (W - L - R) * span)));
      const p = data[i];
      xh.setAttribute('x1', X(p.etd)); xh.setAttribute('x2', X(p.etd)); xh.setAttribute('visibility', 'visible');
      showTip(`<b>${kd(p.etd)} 출항</b><br>${cs.map((c) => `<span class="dot" style="background:${SERIES[c]}"></span>${esc(c)} USD ${fmt(p[c])}`).join('<br>')}`, ev.clientX, ev.clientY);
    });
    ov.addEventListener('mouseleave', () => { xh.setAttribute('visibility', 'hidden'); hideTip(); });
    box.replaceChildren(s);
  }
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (current === 'timeline') drawTimeline(); }, 150); });

  // ---------- 검증 리포트 ----------
  const CASE_NOTE = [
    [(c) => c.carrier === 'CMA CGM' && /Dangerous/i.test(c.code), '위험물 할증을 일반 화물 대상으로 적음', "원문 'IMDG Dry'(위험물 중 Dry 컨테이너)를 AI가 일반 Dry로 적었습니다. 그대로 쓰면 해당 구간의 일반 화물 견적에 위험물 할증(컨테이너당 USD 5,000 등)이 붙습니다. 검사기는 근거 구절과 금액이 원문에 있는지만 보므로 이 오류를 못 거릅니다. 자동 승인됐는데 틀린 4개가 모두 이 경우라, 실증에서는 위험물 표기를 검사 규칙에 넣습니다."],
    [(c) => c.carrier === 'ONE' && /^IH[DL]$/.test(c.code), '공지에 없는 컨테이너 타입을 채움', '공지에 컨테이너 타입이 따로 적혀 있지 않은데 AI가 Dry로 채웠습니다. 금액과 시작일은 맞았습니다. 검사기가 사람 확인으로 보낸 것들입니다.'],
    [(c) => c.carrier === 'Maersk' && /storage/i.test(c.code), '보관료 단위', "'TEU당 하루' 요금을 AI는 'TEU당'으로만 적었습니다. 기간을 모르면 합계에 넣을 수 없는 값이라 정답은 표준 밖 단위로 둡니다. 사람 확인으로 갔습니다."],
    [(c) => c.carrier === 'Maersk', '같은 요금을 다른 이름으로 적음', "호르무즈 해협 통과 추가요금(USD 1,000)을 AI가 'Strait of Hormuz Emergency Freight rate'라는 이름으로 적어 정답('additional fee')과 짝이 안 맞았습니다. 금액은 맞지만 평가 규칙상 누락 1 + 잘못 추가 1로 셉니다."],
    [(c) => c.carrier === 'MSC', '할증 이름을 비워 둠', '항해 종료 할증(USD 800)을 AI가 약어·이름 없이 금액만 적어 정답과 짝이 안 맞았습니다. 누락 1 + 잘못 추가 1로 셉니다.'],
  ];
  function viewReport() {
    const el = $('#view-report');
    if (el.dataset.ready) return;
    el.dataset.ready = 1;
    const R = S.rep, test = R.tables.test, dev = R.tables.dev, son = test.find((t) => t.run === 'sonnet_v1');
    const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '—');
    const tbl = (rows, cap) => `<div class="tbl-wrap"><table><caption class="sr">${esc(cap)}</caption>
      <thead><tr><th>추출기</th><th class="r">정확 / 정답</th><th class="r">정확 / 추출</th><th class="r">금액 숫자 찾음</th><th class="r">공지 전부 정확</th><th class="r">자동 승인 중 정확</th><th class="r">사람 확인 비율</th></tr></thead>
      <tbody>${rows.map((t) => `<tr class="${t.run === 'sonnet_v1' ? 'best' : ''}"><td>${esc(t.name)}</td><td class="r num">${t.exact}/${t.gold} (${pct(t.exact, t.gold)})</td><td class="r num">${t.exact}/${t.pred} (${pct(t.exact, t.pred)})</td>
        <td class="r num">${(100 * t.amount_hit).toFixed(1)}%</td><td class="r num">${t.notice_complete}/${t.notices}</td><td class="r num">${t.auto_exact}/${t.auto} (${pct(t.auto_exact, t.auto)})</td><td class="r num">${pct(t.review, t.validated)}</td></tr>`).join('')}</tbody></table></div>`;
    const FIELD = { amount: '금액', currency: '통화', unit: '단위', container_size: '크기', container_type: '타입', effective_from: '시작일', effective_to: '종료일', code_as_written: '약어', category: '분류', basis_rule: '기준일 규칙', payment_location: '청구 위치', origin_scope_norm: '출발 범위', destination_scope_norm: '도착 범위', direction_norm: '방향', 'notice.notice_kind': '공지 종류', 'notice.is_surcharge_notice': '할증 공지 여부' };
    const fa = Object.entries(son.field_accuracy).sort((a, b) => a[1] - b[1]);
    const used = new Set();
    const groups = CASE_NOTE.map(([fn, title, note]) => { const items = R.cases.filter((c) => !used.has(c) && fn(c)); items.forEach((c) => used.add(c)); return { title, note, items }; });
    const rest = R.cases.filter((c) => !used.has(c));
    if (rest.length) groups.push({ title: '기타', note: '', items: rest });
    const tm = R.timing, ag = tm.agent.sonnet, mc = tm.machine;
    el.innerHTML = `<div class="rep">
      <div class="view-head"><h1>검증 리포트</h1><p>AI 추출이 얼마나 맞는지, 무엇을 틀리는지, 틀린 것을 어떻게 거르는지 공개합니다. 숫자는 "n개 중 m개"로 씁니다. 표본이 작기 때문입니다.</p></div>
      <section><h2>정답을 만든 방법</h2>
        <ol class="steps">
          <li>수집한 공지 80건 중 45건(시험 3, dev 11, test 31)을 정답셋으로 정했습니다. 선사 ${R.gold.carriers.length}곳: ${esc(R.gold.carriers.join(', '))}.</li>
          <li>test는 Claude가 1차 라벨을 만들고, 1차를 보지 않은 별도 에이전트가 2차 라벨을 만들어 대조했습니다. 값이 다른 22개를 원문으로 확인해 1차를 고쳤고, 표기 관례 차이 9개가 남았습니다.</li>
          <li>사람(패스파인더)이 test ${R.gold.test_records}개 레코드를 전부 원문과 대조했습니다(이상 없음). 시험 3건도 사람이 확인했습니다. dev 11건은 지시문을 다듬는 데만 써서 Claude 라벨 그대로입니다.</li>
          <li>추출기는 정답을 볼 수 없는 별도 작업 공간에서, 측정 전에 고정한 지시문으로 돌렸습니다. 규칙은 dev로만 다듬었습니다.</li>
        </ol></section>
      <section><h2>test 결과: 공지 ${son.notices}건, 정답 레코드 ${son.gold}개</h2>
        <p>레코드 = 할증 하나, 또는 공지에 함께 나온 반납·보관·항만 요금 하나. 정확 = 같은 요금으로 짝지어지고 금액·통화·단위·크기·타입·시작일 6칸이 모두 맞은 것. 자동 승인 = 규칙 검사기를 통과해 사람 확인 없이 쓰는 것. 사람 확인 비율의 분모는 각 추출기가 뽑은 레코드 수입니다.</p>
        ${tbl(test, 'test 결과')}
        <details class="sub" style="padding:12px 0 0;border:0"><summary>dev 결과(지시문을 다듬는 데 쓴 세트, 공지 14건)</summary><div style="margin-top:10px">${tbl(dev, 'dev 결과')}</div></details></section>
      <section><h2>Claude Sonnet, 칸별 정확도</h2>
        <p>짝지어진 할증 ${son.gold - 2}개에서 칸마다 정답과 같은 비율입니다. 범위(출발 지역 표기)가 가장 약합니다.</p>
        <div class="tbl-wrap"><table><thead><tr><th>칸</th><th>정확도</th></tr></thead><tbody>${fa.map(([k, v]) => `<tr><td>${esc(FIELD[k] || k)}</td><td class="num"><span class="bar" style="width:${Math.max(2, v * 220)}px"></span>${(100 * v).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div></section>
      <section><h2>선사별(Claude Sonnet)</h2>
        <div class="tbl-wrap"><table><thead><tr><th>선사</th><th class="r">공지</th><th class="r">정답 레코드</th><th class="r">정확</th></tr></thead><tbody>${Object.entries(R.by_carrier).map(([c, b]) => `<tr><td>${esc(c)}</td><td class="r num">${b.notices}</td><td class="r num">${b.gold}</td><td class="r num">${b.exact} (${pct(b.exact, b.gold)})</td></tr>`).join('')}</tbody></table></div></section>
      <section><h2>정답과 다른 것 ${R.cases.length}건, 전부</h2>
        <p>칸이 정답과 다른 ${R.cases.filter((c) => c.kind === 'diff').length}개, 이름이 달라 짝을 못 지은 ${R.cases.filter((c) => c.kind === 'missed').length}쌍(누락 ${R.cases.filter((c) => c.kind === 'missed').length}, 잘못 추가 ${R.cases.filter((c) => c.kind === 'extra').length})입니다. 정확 ${son.exact}/${son.gold}에서 빠진 ${son.gold - son.exact}개가 앞의 두 종류입니다. 근거 구절은 정답의 것입니다.</p>
        ${groups.filter((g) => g.items.length).map((g) => `<div class="case"><h3>${esc(g.title)} (${g.items.length}개)</h3><p>${esc(g.note)}</p>
          <p class="small muted" style="margin-top:6px">${esc(g.items[0].carrier)}: <a href="${noticeHref(g.items[0].notice_id)}">${esc(g.items[0].title)}</a>${g.items[0].diff ? ' · 정답과 AI: ' + Object.entries(g.items[0].diff).map(([k, v]) => `${FIELD[k] || k} ${v[0]} / ${v[1]}`).join(', ') : ''}${g.items.some((c) => c.auto) ? ' · ' + chip('late', `자동 승인됨 ${g.items.filter((c) => c.auto).length}`) : ''}</p>
          <ul class="ev">${(g.items[0].evidence || []).slice(0, 1).map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`).join('')}</section>
      <section><h2>사람 확인으로 보내는 이유</h2>
        <p>Claude Sonnet test 추출 ${son.validated}개 중 ${son.review}개(${pct(son.review, son.validated)})를 검사기가 사람 확인으로 보냈습니다. 한 할증에 이유가 여러 개일 수 있습니다.</p>
        <div class="tbl-wrap"><table><thead><tr><th>이유</th><th class="r">할증 수</th></tr></thead><tbody>${Object.entries(son.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(REASON[k] || k)}</td><td class="r num">${v}</td></tr>`).join('')}</tbody></table></div>
        <p style="margin-top:12px">정규식 추출에서는 검사기가 소용이 없었습니다(자동 승인 중 정확 ${pct(test[0].auto_exact, test[0].auto)}). 검사기는 원문 대조만 하므로, 추출기가 약하면 틀린 값도 원문에 있는 숫자라 통과합니다.</p></section>
      <section><h2>처리 시간</h2>
        <div class="tbl-wrap"><table><thead><tr><th>단계</th><th class="r">측정값</th><th>조건</th></tr></thead><tbody>
          <tr><td>AI 추출(Claude Sonnet), 공지 1건</td><td class="r num">중앙값 ${Math.round(ag.median)}초, 90%가 ${Math.round(ag.p90)}초 이내, 최대 ${Math.round(ag.max)}초</td><td class="small">${ag.n}건, 10/1 측정 실행 기록의 타임스탬프. 에이전트가 여러 공지를 이어서 처리한 간격이라 API 단건 호출과 다를 수 있음</td></tr>
          <tr><td>AI 추출(Claude Haiku), 공지 1건</td><td class="r num">중앙값 ${Math.round(tm.agent.haiku.median)}초</td><td class="small">${tm.agent.haiku.n}건, 같은 방식. 정확도는 위 표 참고</td></tr>
          <tr><td>규칙 검사, 공지 1건</td><td class="r num">중앙값 ${mc.validator.median_ms}ms</td><td class="small">공지 ${mc.validator.notices}건, 클라우드 리눅스</td></tr>
          <tr><td>할증 계산, 화물 1건</td><td class="r num">중앙값 ${mc.calculator.median_ms}ms</td><td class="small">${mc.calculator.runs}회, 할증 ${mc.calculator.db_records}개 DB. 이 페이지에서도 계산할 때마다 표시</td></tr>
          <tr><td>사람이 공지를 찾아 계산(수작업)</td><td class="r">측정 예정</td><td class="small">같은 화물 5건을 선사 홈페이지만 보고 풀 때와 계산기로 풀 때를 비교할 계획</td></tr>
        </tbody></table></div></section>
      <section><h2>한계</h2><ul class="lim">
        <li>정답 라벨과 추출기가 같은 Claude 계열입니다. 사람 전수 확인으로 보완했지만, 확인 기록은 줄별로 남기지 않았습니다.</li>
        <li>추출 지시문의 규칙 일부는 test 라벨 작업 중 가이드에 들어갔습니다. test 공지 문구는 넣지 않았습니다.</li>
        <li>표본이 작습니다(test 공지 31건, 선사 7곳). 레코드 93개짜리 Maersk 공지 2건이 결과의 큰 몫을 차지합니다.</li>
        <li>AI 추출 35건(정답 없는 공지)과 dev 정답 11건(Claude 라벨)은 사람 확인 전입니다. 계산기에서 빼고 볼 수 있습니다.</li>
        <li>계산기는 종료일이 없는 할증을 다음 공지가 나올 때까지 계속 붙입니다. 철회 공지를 못 모으면 실제보다 많이 계산될 수 있습니다.</li>
        <li>계산 규칙 중 공지에 없는 판단(TEU 환산, 방향 구분, 기존 부킹 적용 범위)은 해석이며 '확인할 것'으로 표시합니다.</li>
      </ul></section></div>`;
  }

  // ---------- 시작 ----------
  route();
  Promise.all(['db.json', 'scenario.json', 'report.json', 'weekly.json'].map((f) => fetch('data/' + f).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); })))
    .then(([db, sc, rep, wk]) => { S.db = db; S.sc = sc; S.rep = rep; S.wk = wk; route(); })
    .catch((err) => {
      $$('.view').forEach((v) => { if (v.dataset.view !== 'overview') v.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다(${esc(err.message)}). 새로고침해 보세요.</div>`; });
    });
})();
