// 지역 태그 → 국가코드, 항만 목록. 계산 엔진과 웹 화면이 같이 쓴다.
// 태그 정의는 labeling/labeling_guide.md 3장을 따른다. 국가 나열은 계산용 근사이며 선사별 정의와 다를 수 있다.
(function (root) {
  const SEA = ['VN', 'TH', 'MY', 'SG', 'ID', 'PH', 'KH', 'MM', 'BN', 'LA', 'TL'];
  const FE = ['KR', 'JP', 'CN', 'HK', 'TW', 'MO', 'MN'];
  const ISC = ['IN', 'PK', 'BD', 'LK', 'NP', 'MV'];
  const ME_GULF = ['AE', 'SA', 'KW', 'QA', 'BH', 'IQ', 'OM', 'IR'];
  const ME_REDSEA = ['SA', 'JO', 'EG', 'SD', 'ER', 'DJ', 'YE'];
  const NEUR = ['GB', 'IE', 'FR', 'BE', 'NL', 'DE', 'DK', 'NO', 'SE', 'FI', 'PL', 'EE', 'LV', 'LT', 'IS'];
  const MED = ['ES', 'PT', 'FR', 'IT', 'SI', 'HR', 'GR', 'TR', 'MT', 'CY', 'IL', 'LB', 'EG', 'LY', 'TN', 'DZ', 'MA', 'AL', 'ME'];
  const BLACK_SEA = ['RO', 'BG', 'UA', 'GE', 'RU', 'TR'];
  const NAFR = ['EG', 'LY', 'TN', 'DZ', 'MA'];
  const WAFR = ['NG', 'GH', 'CI', 'SN', 'TG', 'BJ', 'CM', 'AO', 'GN', 'SL', 'LR', 'GA', 'CG', 'CD', 'MR', 'GM'];
  const EAFR = ['KE', 'TZ', 'DJ', 'SO', 'ER', 'UG', 'SD', 'MZ'];
  const IOI = ['MU', 'MG', 'RE', 'SC', 'KM', 'YT'];
  const AFR = [...new Set([...NAFR, ...WAFR, ...EAFR, 'ZA', 'NA', 'MZ', 'MG'])];
  const WCSA = ['CL', 'PE', 'EC', 'CO'];
  const ECSA = ['BR', 'AR', 'UY', 'PY'];
  const CARIB = ['JM', 'DO', 'PR', 'TT', 'BS', 'CU', 'HT', 'BB'];
  const CAM = ['GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'BZ', 'MX'];
  const REGIONS = {
    SEA, FE, ISC, ME_GULF, ME_REDSEA, ME: [...new Set([...ME_GULF, ...ME_REDSEA, 'LB', 'IL'])], NEUR, MED, BLACK_SEA,
    NA: ['US', 'CA'], NAFR, WAFR, EAFR, IOI, AFR, WCSA, ECSA, CARIB, CAM, ASIA: [...FE, ...SEA, ...ISC],
    KR: ['KR'], JP: ['JP'],
  };
  // 항만 단위로만 정의되는 태그
  const PORT_TAGS = {
    SCHN: ['CNSZX', 'CNCAN', 'CNXMN', 'CNSWA', 'CNFOC', 'HKHKG'], NCHN: ['CNTAO', 'CNTXG', 'CNDLC', 'CNLYG'],
    NAWC: ['USLAX', 'USLGB', 'USOAK', 'USSEA', 'USTIW', 'CAVAN', 'CAPRR'], NAEC: ['USNYC', 'USSAV', 'USCHS', 'USORF', 'USBAL', 'CAHAL', 'CAMTR'],
  };
  // 무역 구분 판단용 큰 권역(선사 정의가 공지에 없어서 계산기는 항상 '확인 필요'를 붙인다)
  const MACRO = [['ASIA', [...FE, ...SEA, ...ISC]], ['ME', [...ME_GULF, ...ME_REDSEA, 'LB', 'IL']], ['EUR', [...NEUR, ...MED, ...BLACK_SEA]],
                 ['AFR', AFR], ['NAM', ['US', 'CA', 'MX']], ['LATAM', [...WCSA, ...ECSA, ...CARIB, ...CAM]]];
  // 화면에 보여줄 항만(코드, 한글 이름, 원문에 쓰이는 이름들)
  const PORTS = [
    ['KRPUS', '부산', ['Busan', 'Pusan']], ['KRINC', '인천', ['Incheon']], ['KRKAN', '광양', ['Gwangyang']],
    ['AEJEA', '제벨알리', ['Jebel Ali', 'JebelAli']], ['AEAUH', '아부다비', ['Abu Dhabi']], ['AEKLF', '코르파칸', ['Khor Fakkan', 'Khorfakkan']],
    ['AEFJR', '푸자이라', ['Fujairah']], ['AESHJ', '샤르자', ['Sharjah']], ['AEAJM', '아지만', ['Ajman']],
    ['SADMM', '담맘', ['Dammam', 'Damman']], ['SAJUB', '주바일', ['Jubail', 'Al Jubail']], ['SAJED', '제다', ['Jeddah']], ['SAKAC', '킹압둘라', ['King Abdullah']],
    ['QAHMD', '하마드', ['Hamad']], ['KWSWK', '슈와이크', ['Shuwaikh']], ['KWSAA', '슈아이바', ['Shuaiba']], ['BHKBS', '칼리파 빈 살만', ['Khalifa Bin Salman']],
    ['IQUQR', '움카스르', ['Umm Qasr']], ['OMSOH', '소하르', ['Sohar']], ['OMSLL', '살랄라', ['Salalah']], ['JOAQJ', '아카바', ['Aqaba']],
    ['EGSOK', '아인소크나', ['Port of Ain Sokhna', 'Ain Sokhna']],
    ['VNSGN', '호치민', ['HO CHI MINH', '호치민', 'Ho Chi Minh']], ['VNHPH', '하이퐁', ['HAI PHONG', '하이퐁', 'Haiphong']],
    ['THLCH', '램차방', ['Laem Chabang']], ['SGSIN', '싱가포르', ['Singapore']], ['MYPKG', '포트클랑', ['Port Klang']], ['IDJKT', '자카르타', ['Jakarta']],
    ['PHMNL', '마닐라', ['Manila']], ['INNSA', '나바셰바', ['Nhava Sheva']], ['PKKHI', '카라치', ['Karachi']], ['BDCGP', '치타공', ['Chittagong']],
    ['CNSHA', '상하이', ['Shanghai']], ['CNTAO', '칭다오', ['Qingdao']], ['CNDLC', '다롄', ['Dalian']], ['CNTXG', '신강', ['Xingang']], ['CNSZX', '선전', ['Shenzhen']],
    ['HKHKG', '홍콩', ['Hong Kong']], ['TWKHH', '가오슝', ['Kaohsiung']], ['JPTYO', '도쿄', ['Tokyo']], ['JPOSA', '오사카', ['Osaka']],
    ['RUVVO', '블라디보스토크', ['Vladivostok']], ['DEHAM', '함부르크', ['Hamburg']], ['NLRTM', '로테르담', ['Rotterdam']], ['ITTRS', '트리에스테', ['Trieste']],
    ['TRMER', '메르신', ['Mersin']], ['USLAX', '로스앤젤레스', ['Los Angeles']], ['USNYC', '뉴욕', ['New York']], ['CAVAN', '밴쿠버', ['Vancouver']],
    ['SDPZU', '포트수단', ['Port Sudan']], ['ERMSW', '마사와', ['Massawa']], ['ZADUR', '더반', ['Durban']], ['NGAPP', '라고스', ['Lagos', 'Apapa']],
    ['KEMBA', '몸바사', ['Mombasa']], ['BRSSZ', '산투스', ['Santos']],
  ];
  const portName = {}; const portByAlias = {};
  PORTS.forEach(([code, ko, aliases]) => { portName[code] = ko; [code, ko, ...aliases].forEach((a) => { portByAlias[a.toLowerCase()] = code; }); });
  const country = (port) => port.slice(0, 2);
  function inTag(tag, port) {
    const c = country(port);
    if (tag === 'GLOBAL') return true;
    if (PORT_TAGS[tag]) return PORT_TAGS[tag].includes(port);
    if (REGIONS[tag]) return REGIONS[tag].includes(c);
    return tag === c; // 국가코드
  }
  function macro(port) { const c = country(port); const m = MACRO.find(([, list]) => list.includes(c)); return m ? m[0] : 'OTHER'; }
  const api = { REGIONS, PORT_TAGS, PORTS, portName, portByAlias, country, inTag, macro, TRADE_TAGS: ['LONG_HAUL', 'INTRA_TRADE', 'SHORT_SEA'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Geo = api;
})(typeof self !== 'undefined' ? self : this);
