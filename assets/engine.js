// 화물 한 건에 붙는 할증 계산 엔진. 브라우저(window.Calc)와 node(require) 양쪽에서 쓴다.
// 원칙: 공지에 없는 판단(항로 구분, TEU 환산, 기준일 차이 등)은 추정해서 넣되 반드시 '확인 필요'로 표시한다.
(function (root) {
  const TEU = { '20': 1, '40': 2, '40HC': 2, '45': 2.25 };
  const SPECIAL = ['special', 'open_top', 'flat_rack'];
  const norm = (s) => (s || '').toUpperCase().replace(/\s+/g, '');
  const grouped = (r) => (r.conditions || []).filter((c) => c.startsWith('grouped:')).flatMap((c) => c.slice(8).split(','));
  const excludes = (r) => (r.conditions || []).filter((c) => c.startsWith('excludes:')).flatMap((c) => c.slice(9).split(','));

  function sizeMatch(r, size) {
    const g = grouped(r);
    if (r.container_size === size || r.container_size === 'all' || g.includes(size)) return { ok: true };
    if (r.container_size === 'not_stated') return { ok: true, flag: '공지에 컨테이너 크기가 없음' };
    if ((r.container_size === '40' && size === '40HC') || (r.container_size === '40HC' && size === '40')) return { ok: 'near', flag: `${r.container_size} 요율을 ${size}에 적용(공지는 둘을 구분)` };
    return { ok: false };
  }
  function typeMatch(r, type) {
    const g = grouped(r);
    const t = r.container_type;
    if (t === type || t === 'all' || g.includes(type)) return { ok: true };
    if (type === 'special' && (SPECIAL.includes(t) || g.some((x) => SPECIAL.includes(x)))) return { ok: true, flag: '특수 컨테이너 세부 타입(Open Top, Flat Rack 등) 확인 필요' };
    if (type === 'dg' && g.includes('dg')) return { ok: true };
    if (t === 'not_stated') return { ok: true, flag: '공지에 컨테이너 타입이 없음' };
    return { ok: false };
  }

  // 범위 판단. 반환: {ok:true|false, flags:[], excluded:'이유'}
  function scopeMatch(r, ship, geo) {
    const flags = [];
    const o = ship.origin, d = ship.destination;
    const oc = geo.country(o), dc = geo.country(d);
    if (r.direction_norm === 'export_from_kr' && oc !== 'KR') return { ok: false };
    if (r.direction_norm === 'import_to_kr' && dc !== 'KR') return { ok: false };
    let specific = false; // 국가코드나 항만 태그로 맞았으면 지역 태그보다 구체적
    const sideOk = (tags, port) => {
      if (!tags || !tags.length) return null; // 미기재
      const trade = tags.filter((t) => geo.TRADE_TAGS.includes(t));
      const hit = tags.filter((t) => !geo.TRADE_TAGS.includes(t) && geo.inTag(t, port));
      if (hit.length) { if (hit.some((t) => /^[A-Z]{2}$/.test(t) && !geo.REGIONS[t] || geo.PORT_TAGS[t])) specific = true; return true; }
      if (trade.length) {
        const same = geo.macro(o) === geo.macro(d);
        const okTrade = trade.some((t) => (t === 'LONG_HAUL' ? !same : same));
        if (okTrade) flags.push(`항로 구분(${trade.join('/')})은 공지에 정의가 없음. 대권역 기준으로 추정`);
        return okTrade;
      }
      return false;
    };
    const os = sideOk(r.origin_scope_norm, o), ds = sideOk(r.destination_scope_norm, d);
    let ok;
    if (r.direction_norm === 'from_or_to') {
      const scope = (r.origin_scope_norm && r.origin_scope_norm.length) ? r.origin_scope_norm : r.destination_scope_norm;
      // 한국과 다른 지역이 함께 적힌 구간(예: 한-일 KR, JP)은 양 끝이 모두 범위 안이어야 한다. 그 밖에는 출발·도착 중 하나만 맞으면 된다.
      const route = scope.length >= 2 && scope.includes('KR');
      ok = route ? (sideOk(scope, o) && sideOk(scope, d)) : (sideOk(scope, o) || sideOk(scope, d));
      if (ok === null) { ok = true; flags.push('공지에 적용 범위가 없음'); }
    } else {
      if (os === false || ds === false) return { ok: false };
      ok = true;
      if (os === null && ds === null) flags.push('공지에 적용 범위가 없음');
    }
    if (!ok) return { ok: false };
    // 항만 한정: 같은 나라 항만이 목록에 있으면 그 항만이어야 한다
    const listed = (r.ports_as_written || []).map((p) => geo.portByAlias[p.toLowerCase()]).filter(Boolean);
    for (const port of [o, d]) {
      const same = listed.filter((p) => geo.country(p) === geo.country(port));
      if (same.length && !same.includes(port)) return { ok: false };
    }
    // 제외 조건
    for (const x of excludes(r)) {
      const xs = x.trim();
      const portCode = geo.portByAlias[xs.toLowerCase()] || (/^[A-Z]{5}$/.test(xs) ? xs : null);
      if (portCode) {
        if (portCode === o || portCode === d) return { ok: false, excluded: `제외 항만(${xs})` };
        continue;
      }
      const hitO = geo.inTag(xs, o), hitD = geo.inTag(xs, d);
      if (r.direction_norm === 'from_or_to' ? (hitO && hitD) : (hitO && (r.origin_scope_norm || []).includes('GLOBAL')) || (hitD && (r.destination_scope_norm || []).includes('GLOBAL')) || (!r.origin_scope_norm.length && hitO) || (!r.destination_scope_norm.length && hitD)) {
        return { ok: false, excluded: `제외 범위(${xs})` };
      }
    }
    if (listed.length) specific = true;
    return { ok: true, flags, specific };
  }

  function basisDate(r, ship) {
    const f = [];
    let date = ship.etd;
    switch (r.basis_rule) {
      case 'booking_date': if (ship.booking) date = ship.booking; else f.push('부킹일 기준인데 부킹일 입력이 없어 출항일로 판단'); break;
      case 'arrival_date': if (ship.eta) date = ship.eta; else f.push('입항일 기준인데 입항일 입력이 없어 출항일로 판단'); break;
      case 'price_calculation_date': f.push('가격 산정일(PCD) 기준. 비SPOT은 부킹 확정 시점의 첫 선적 예정 출항일'); break;
      case 'gate_in_date': f.push('반입일 기준. 출항일보다 며칠 앞설 수 있음'); break;
      case 'cargo_status': f.push('화물 상태(선적 전·운항 중 등) 조건. 실제 상태 확인 필요'); break;
      case 'not_stated': f.push('공지에 기준일이 없음. 출항일로 판단'); break;
      default: break;
    }
    if ((r.conditions || []).includes('applies_to_cargo_in_transit')) {
      if (ship.etd > date) date = ship.etd;
      f.push('기존 부킹·운항 중 화물에도 적용(출항일 기준으로 판단)');
    }
    return { date, flags: f };
  }

  function money(r, ship) {
    if (r.amount === null || r.amount === undefined) return { total: null, flags: ['공지에 금액이 없음'] };
    const q = ship.qty || 1;
    switch (r.unit) {
      case 'per_container': return { total: r.amount * q, flags: [] };
      case 'per_teu': return { total: r.amount * TEU[ship.size] * q, flags: [`TEU당 요율. ${ship.size}=${TEU[ship.size]}TEU로 환산(환산 규칙은 공지에 없음)`] };
      case 'per_bl': return { total: r.amount, flags: ['B/L당 요금. 컨테이너 수와 무관'] };
      case 'percent_of_base': return { total: null, flags: [`운임의 ${r.amount}%. 기준 운임이 있어야 계산 가능`] };
      default: return { total: null, flags: ['단위가 표준이 아님(일당 보관료 등). 합계에서 제외'] };
    }
  }

  // 같은 할증의 다른 이름(약어 없이 풀네임만 쓴 경우, LSS/LSF처럼 같은 뜻의 약어)을 한 묶음으로
  const SYN = { LSF: 'LSS', LOWSULPHURSURCHARGE: 'LSS', LOWSULPHURFUELSURCHARGE: 'LSS', EMERGENCYBUNKERSURCHARGE: 'EBS', PEAKSEASONSURCHARGE: 'PSS',
                EMERGENCYFUELSURCHARGE: 'EFS', BUNKERADJUSTMENTFACTOR: 'BAF', '유류할증료': 'BAF', TERMINALHANDLINGCHARGE: 'THC' };
  const famKey = (r) => { const k = norm(r.code_as_written) || norm(r.name_as_written).replace(/\(.*?\)/g, ''); return SYN[k] || k; };
  const groupKey = (r) => [r.carrier, famKey(r), r.direction_norm].join('|');
  const VERIFIED = ['auto', 'reviewed', 'corrected'];

  function calculate(db, ship, geo) {
    const notices = db.notices;
    const cand = [];
    const excluded = [];
    for (const r of db.records) {
      if (ship.carrier && ship.carrier !== '*' && r.carrier !== ship.carrier) continue;
      if (ship.verifiedOnly && !VERIFIED.includes(r.ai)) continue;
      if (!ship.includeLocal && r.category === 'local_port') continue;
      const sz = sizeMatch(r, ship.size); if (!sz.ok) continue;
      const ty = typeMatch(r, ship.type); if (!ty.ok) continue;
      const sc = scopeMatch(r, ship, geo);
      if (!sc.ok) { if (sc.excluded) excluded.push({ r, reason: sc.excluded }); continue; }
      const bd = basisDate(r, ship);
      // 적용 시작일이 없으면 게시일을 시작으로 본다(게시 전 화물에는 붙이지 않음)
      const pub = notices[r.notice_id].published_date;
      const from = r.effective_from || pub, to = r.effective_to;
      let timing = 'active';
      if (from && bd.date < from) timing = 'upcoming';
      if (to && bd.date > to) timing = 'expired';
      if (timing === 'expired') continue;
      // 화물 상태 조건(기존 부킹·운항 중 화물)이고 시작일이 없으면: 게시 시점에 이미 있던 부킹에만 붙인다
      if (r.basis_rule === 'cargo_status' && !r.effective_from && pub) {
        if (ship.booking && ship.booking > pub) continue;
        if (!ship.booking) bd.flags.push('기존 부킹·운항 중 화물 대상. 부킹일 입력이 없어 붙여서 계산');
      }
      if (ship.categories && !ship.categories.includes(r.category)) continue;
      const m = money(r, ship);
      const flags = [...(VERIFIED.includes(r.ai) ? [] : ['AI 추출 결과, 사람 확인 전' + (r.ai === 'ai_review' ? '(검사기가 검토 필요로 표시)' : '')]), ...(sc.flags || []), ...(sz.flag ? [sz.flag] : []), ...(ty.flag ? [ty.flag] : []), ...bd.flags, ...m.flags];
      if (!r.effective_from) flags.push(pub ? `공지에 적용 시작일이 없음. 게시일(${pub})부터로 판단` : '공지에 적용 시작일·게시일이 없음');
      if ((r.conditions || []).includes('effective_date_varies_by_origin')) flags.push(`출발지·규제국에 따라 적용일이 다름: "${r.effective_from_text}"`);
      if ((r.conditions || []).includes('subject_to_regulatory_approval')) flags.push('규제 승인 전제(미국 FMC 등)');
      if ((r.conditions || []).includes('contract_bookings_only')) flags.push('계약(Non-SPOT) 부킹에만 적용');
      if ((r.conditions || []).includes('included_in_freight')) flags.push('공지상 운임에 포함된 할증이라 합계에서 뺌');
      if ((r.conditions || []).includes('may_be_included_in_freight')) flags.push('일부 출발지는 운임에 포함됐을 수 있음(이중 계산 주의)');
      const rank = (sz.ok === 'near' ? 2 : 0) + (r.container_size === 'not_stated' || r.container_type === 'not_stated' ? 1 : 0) + (sc.specific ? 0 : 0.5);
      cand.push({ r, notice: notices[r.notice_id], timing, total: m.total, flags: [...new Set(flags)], sortDate: from || '', rank }); // 출발·도착 양쪽에서 같은 표시가 나오면 하나로
    }
    // 같은 할증(선사·코드·방향)은 기준일까지 시작한 것 중 가장 최근 것 하나만.
    // 시작일이 같으면 크기·타입·범위가 정확히 맞는 것을 우선하고, 같은 공지 안에서 통화만 다른 대안(USD/EUR)은 USD를 남긴다.
    const groups = {};
    for (const c of cand.filter((x) => x.timing === 'active')) (groups[groupKey(c.r)] = groups[groupKey(c.r)] || []).push(c);
    const lines = [];
    for (const list of Object.values(groups)) {
      list.sort((a, b) => (b.sortDate > a.sortDate ? 1 : b.sortDate < a.sortDate ? -1 : 0) || (a.rank - b.rank) ||
        ((a.r.currency === 'USD' ? 0 : 1) - (b.r.currency === 'USD' ? 0 : 1)));
      const best = list[0];
      const otherCur = [...new Set(list.filter((x) => x.r.notice_id === best.r.notice_id && x.r.currency !== best.r.currency).map((x) => x.r.currency))];
      if (otherCur.length) best.flags.push('같은 공지에 다른 통화 요율도 있음(' + otherCur.join(', ') + ')');
      best.superseded = list.filter((x) => x.r.notice_id !== best.r.notice_id).map((x) => x.r.id);
      lines.push(best);
    }
    // 방향(Headhaul/Backhaul 등)만 다른 같은 할증은 대안으로 묶는다
    const alt = {};
    for (const c of lines) { const k = c.r.carrier + '|' + famKey(c.r) + '|' + c.r.notice_id; (alt[k] = alt[k] || []).push(c); }
    const out = [];
    for (const list of Object.values(alt)) {
      const dirs = new Set(list.map((c) => c.r.direction_norm));
      const isAlt = list.length > 1 && dirs.size > 1;
      list.forEach((c) => {
        const included = (c.r.conditions || []).includes('included_in_freight');
        const status = c.total === null ? 'no_total' : included ? 'included' : (isAlt ? 'alternative' : 'applied');
        if (isAlt) c.flags.push('방향(Headhaul/Backhaul 등) 구분이 공지에 없어 후보 ' + list.length + '개 중 하나');
        out.push({ ...c, status, altGroup: isAlt ? list[0].r.id : null });
      });
    }
    // 예정: 같은 공지·할증·방향·크기에서 USD가 있으면 다른 통화 대안은 뺀다
    const upAll = cand.filter((c) => c.timing === 'upcoming');
    const upBest = {};
    for (const c of upAll) {
      const k = c.r.notice_id + '|' + groupKey(c.r);
      const b = upBest[k];
      const better = !b || (c.r.currency === 'USD' && b.r.currency !== 'USD') || ((c.r.currency === b.r.currency) && c.rank < b.rank);
      if (better) upBest[k] = c;
    }
    const upcoming = Object.values(upBest).sort((a, b) => (a.sortDate < b.sortDate ? -1 : 1)).map((c) => ({ ...c, status: 'upcoming' }));
    // 합계: 선사별·통화별. 대안 묶음은 최소~최대로.
    const totals = {};
    let carrierNow = null;
    const add = (cur, lo, hi) => {
      const t = (totals[carrierNow] = totals[carrierNow] || {});
      t[cur] = t[cur] || { min: 0, max: 0 }; t[cur].min += lo; t[cur].max += hi;
    };
    const seenAlt = new Set();
    for (const l of out) {
      if (l.total === null) continue;
      carrierNow = l.r.carrier;
      const cur = l.r.currency || '?';
      if (l.status === 'applied') add(cur, l.total, l.total);
      else if (l.status === 'alternative' && !seenAlt.has(l.altGroup)) {
        seenAlt.add(l.altGroup);
        const vals = out.filter((x) => x.altGroup === l.altGroup && x.total !== null).map((x) => x.total);
        add(cur, Math.min(...vals), Math.max(...vals));
      }
    }
    return { lines: out, upcoming, excluded, totals };
  }

  const api = { calculate, TEU };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Calc = api;
})(typeof self !== 'undefined' ? self : this);
