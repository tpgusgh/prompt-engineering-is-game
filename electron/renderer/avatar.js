// electron/renderer/avatar.js
// The hero's look: 640×640 pixel-art layers stacked in order (body, socks,
// shoes, outfit, eyes, mouth, hair, glasses, hat, weapon) with the pet beside.
// Items come from avatar/catalog.json (scripts/build-avatar.mjs); names are
// put together from the parts of each file name, in the UI language.
import catalog from './avatar/catalog.json' with { type: 'json' };
import { currentLang } from './i18n.js';

export const CATALOG = catalog.items;
export const SLOTS = ['body', 'eyes', 'mouth', 'hair', 'outfit', 'socks', 'shoes', 'hat', 'face', 'weapon', 'pet'];
const LAYERS = ['body', 'socks', 'shoes', 'outfit', 'eyes', 'mouth', 'hair', 'face', 'hat', 'weapon'];
export const DEFAULT_AVATAR = {
  body: 'characters/b_m_fair',
  eyes: 'eyes/eye_normal',
  mouth: 'expressions/expr_smile',
  hair: 'hair/hair_short_black',
  outfit: 'outfits/hoodie',
  socks: 'socks/socks_white',
  shoes: 'shoes/shoes_sneaker_white',
};
export const itemById = (id) => CATALOG.find((i) => i.id === id);
// Slots that may be left empty (no hat, no pet...).
export const OPTIONAL = new Set(['hat', 'face', 'weapon', 'pet', 'socks', 'shoes']);

export const SLOT_NAME = {
  body: ['몸', 'Body', 'からだ'], eyes: ['눈', 'Eyes', '目'], mouth: ['표정', 'Mouth', '表情'], hair: ['머리', 'Hair', '髪'],
  outfit: ['옷', 'Outfit', '服'], socks: ['양말', 'Socks', '靴下'], shoes: ['신발', 'Shoes', '靴'], hat: ['모자', 'Hat', '帽子'],
  face: ['안경', 'Glasses', 'メガネ'], weapon: ['무기', 'Weapon', '武器'], pet: ['펫', 'Pet', 'ペット'],
};
const L = () => ({ ko: 0, en: 1, ja: 2 })[currentLang()] ?? 0;
export const slotName = (slot) => SLOT_NAME[slot]?.[L()] ?? slot;

// [한국어, English, 日本語]
const COLORS = {
  black: ['검정', 'black', '黒'], brown: ['갈색', 'brown', '茶'], blonde: ['금발', 'blonde', '金髪'], pink: ['분홍', 'pink', 'ピンク'], silver: ['은발', 'silver', '銀'],
  red: ['빨강', 'red', '赤'], white: ['하양', 'white', '白'], blue: ['파랑', 'blue', '青'], green: ['초록', 'green', '緑'], gray: ['회색', 'gray', '灰'],
  navy: ['남색', 'navy', '紺'], gold: ['금색', 'gold', '金'], golden: ['황금', 'golden', '黄金'], purple: ['보라', 'purple', '紫'], yellow: ['노랑', 'yellow', '黄'],
  orange: ['주황', 'orange', 'オレンジ'], teal: ['청록', 'teal', '青緑'], mint: ['민트', 'mint', 'ミント'], lavender: ['라벤더', 'lavender', 'ラベンダー'], ivory: ['아이보리', 'ivory', 'アイボリー'],
  wine: ['와인', 'wine', 'ワイン'], berry: ['베리', 'berry', 'ベリー'], coral: ['코랄', 'coral', 'コーラル'], mauve: ['모브', 'mauve', 'モーブ'], nude: ['누드', 'nude', 'ヌード'],
  plum: ['자두', 'plum', 'プラム'], tan: ['탄', 'tan', 'タン'], rainbow: ['무지개', 'rainbow', '虹'], bw: ['흑백', 'black & white', '白黒'], rw: ['빨강·하양', 'red & white', '赤白'],
  w: ['하양', 'white', '白'], gothic: ['고딕', 'gothic', 'ゴシック'], dark: ['진한', 'dark', '濃い'], deep: ['깊은', 'deep', '深い'], fair: ['밝은', 'fair', '明るい'],
  medium: ['보통', 'medium', '普通'], olive: ['올리브', 'olive', 'オリーブ'], pale: ['창백한', 'pale', '色白'], poison: ['독', 'poison', '毒'], calico: ['삼색', 'calico', '三毛'],
};
const WORDS = {
  ...COLORS,
  afro: ['아프로', 'afro', 'アフロ'], bob: ['단발', 'bob', 'ボブ'], bun: ['똥머리', 'bun', 'お団子'], curly: ['곱슬', 'curly', 'くせ毛'], halfup: ['반묶음', 'half-up', 'ハーフアップ'],
  long: ['긴 머리', 'long', 'ロング'], mohawk: ['모히칸', 'mohawk', 'モヒカン'], pigtails: ['양갈래', 'pigtails', 'おさげ'], ponytail: ['포니테일', 'ponytail', 'ポニーテール'],
  short: ['짧은 머리', 'short', 'ショート'], sideswept: ['옆머리', 'side-swept', '流し前髪'], twintails: ['트윈테일', 'twintails', 'ツインテール'], wavy: ['웨이브', 'wavy', 'ウェーブ'],
  baseball: ['야구', 'baseball', '野球'], jersey: ['저지', 'jersey', 'ジャージ'], blazer: ['블레이저', 'blazer', 'ブレザー'], cargo: ['카고', 'cargo', 'カーゴ'], tee: ['티셔츠', 'tee', 'Tシャツ'],
  check: ['체크', 'check', 'チェック'], shirt: ['셔츠', 'shirt', 'シャツ'], crop: ['크롭', 'crop', 'クロップ'], highwaist: ['하이웨이스트', 'high-waist', 'ハイウエスト'], denim: ['데님', 'denim', 'デニム'],
  jacket: ['재킷', 'jacket', 'ジャケット'], floral: ['꽃무늬', 'floral', '花柄'], dress: ['원피스', 'dress', 'ワンピース'], hoodie: ['후드티', 'hoodie', 'パーカー'], knit: ['니트', 'knit', 'ニット'],
  sweater: ['스웨터', 'sweater', 'セーター'], polo: ['폴로', 'polo', 'ポロ'], slip: ['슬립', 'slip', 'スリップ'], stripe: ['줄무늬', 'striped', 'ストライプ'], suit: ['정장', 'suit', 'スーツ'],
  tracksuit: ['트레이닝복', 'tracksuit', 'ジャージ上下'], jiro: ['지로', 'Jiro', 'ジロ'], boy: ['소년', 'boy', '少年'], girl: ['소녀', 'girl', '少女'], layer: ['레이어드', 'layered', 'レイヤード'],
  punk: ['펑크', 'punk', 'パンク'], lolita: ['로리타', 'lolita', 'ロリータ'], party: ['파티', 'party', 'パーティー'], ugly: ['어글리', 'ugly', 'アグリー'], f: ['여', 'F', '女'], m: ['남', 'M', '男'],
  female: ['여', 'female', '女'], male: ['남', 'male', '男'], elf: ['엘프', 'elf', 'エルフ'], gingerbread: ['진저브레드', 'gingerbread', 'ジンジャーブレッド'], reindeer: ['루돌프', 'reindeer', 'トナカイ'],
  santa: ['산타', 'Santa', 'サンタ'], snowman: ['눈사람', 'snowman', '雪だるま'], tree: ['트리', 'tree', 'ツリー'], xmas: ['크리스마스', 'Christmas', 'クリスマス'],
  angry: ['화난', 'angry', '怒り'], big: ['큰', 'big', '大きい'], dot: ['점', 'dot', '点'], happy: ['행복한', 'happy', 'ハッピー'], heart: ['하트', 'heart', 'ハート'], basic: ['기본', 'basic', '基本'],
  cat: ['고양이', 'cat', 'ネコ'], heavy: ['진한', 'heavy', '濃い'], normal: ['보통', 'normal', '普通'], sleepy: ['졸린', 'sleepy', '眠い'], star: ['별', 'star', '星'],
  bigsmile: ['활짝 웃음', 'big smile', '満面の笑み'], crying: ['우는', 'crying', '泣き'], glitter: ['반짝이 입술', 'glitter lips', 'ラメリップ'], gradient: ['그라데이션 입술', 'gradient lips', 'グラデリップ'],
  mermaid: ['인어', 'mermaid', 'マーメイド'], grin: ['씩 웃음', 'grin', 'ニヤリ'], kiss: ['뽀뽀', 'kiss', 'キス'], mouth: ['입', 'mouth', '口'], smile: ['미소', 'smile', 'ほほえみ'],
  drool: ['침 흘림', 'drool', 'よだれ'], exclaim: ['놀람', 'exclaim', 'びっくり'], flat: ['무표정', 'flat', '真顔'], frown: ['찡그림', 'frown', 'しかめっ面'], lick: ['날름', 'lick', 'ペロリ'],
  open: ['벌린', 'open', '開いた'], o: ['오', 'O', 'O'], pout: ['삐죽', 'pout', 'ふくれ'], smirk: ['비웃음', 'smirk', 'にやけ'], l: ['왼쪽', 'left', '左'], r: ['오른쪽', 'right', '右'],
  stitch: ['꿰맨', 'stitched', '縫い目'], teeth: ['이', 'teeth', '歯'], grit: ['악문', 'gritted', '食いしばり'], uwu: ['uwu', 'uwu', 'uwu'], x: ['X', 'X', 'X'], zipper: ['지퍼', 'zipper', 'チャック'],
  sad: ['슬픈', 'sad', '悲しい'], surprised: ['깜짝', 'surprised', '驚き'], tongue: ['메롱', 'tongue', 'あっかんべー'],
  beanie: ['비니', 'beanie', 'ニット帽'], bonnet: ['보닛', 'bonnet', 'ボンネット'], crown: ['왕관', 'crown', '王冠'], hat: ['모자', 'hat', '帽子'], mini: ['미니', 'mini', 'ミニ'], top: ['탑', 'top', 'トップ'],
  tophat: ['실크햇', 'top hat', 'シルクハット'], round: ['동그란', 'round', '丸'], glasses: ['안경', 'glasses', 'メガネ'], sunglasses: ['선글라스', 'sunglasses', 'サングラス'], wizard: ['마법사', 'wizard', '魔法使い'],
  headband: ['머리띠', 'headband', 'カチューシャ'],
  ankleboot: ['앵클부츠', 'ankle boots', 'アンクルブーツ'], heel: ['힐', 'heels', 'ヒール'], kneeboot: ['니하이부츠', 'knee boots', 'ニーハイブーツ'], loafer: ['로퍼', 'loafers', 'ローファー'],
  maryjane: ['메리제인', 'Mary Janes', 'メリージェーン'], platform: ['통굽', 'platforms', '厚底'], sandal: ['샌들', 'sandals', 'サンダル'], slipper: ['슬리퍼', 'slippers', 'スリッパ'],
  sneaker: ['운동화', 'sneakers', 'スニーカー'], airmax: ['에어', 'air', 'エア'], sports: ['스포츠화', 'sports shoes', 'スポーツシューズ'],
  knee: ['무릎', 'knee', 'ハイ'], thigh: ['사이하이', 'thigh-high', 'サイハイ'], solid: ['무지', 'solid', '無地'], frill: ['프릴', 'frill', 'フリル'], lace: ['레이스', 'lace', 'レース'],
  axe: ['도끼', 'axe', '斧'], bat: ['배트', 'bat', 'バット'], bow: ['활', 'bow', '弓'], club: ['곤봉', 'club', 'こん棒'], frying: ['프라이', 'frying', 'フライ'], pan: ['팬', 'pan', 'パン'],
  hammer: ['망치', 'hammer', 'ハンマー'], wand: ['완드', 'wand', 'ワンド'], mace: ['철퇴', 'mace', 'メイス'], magical: ['마법', 'magical', '魔法の'], scythe: ['낫', 'scythe', '大鎌'],
  spellbook: ['마법서', 'spellbook', '魔導書'], staff: ['지팡이', 'staff', '杖'], sword: ['검', 'sword', '剣'], candy: ['사탕', 'candy', 'キャンディ'], cane: ['지팡이', 'cane', 'ケーン'],
  gift: ['선물', 'gift', 'プレゼント'], box: ['상자', 'box', '箱'], snowflake: ['눈송이', 'snowflake', '雪の結晶'], bell: ['종', 'bell', 'ベル'],
  dog: ['강아지', 'dog', 'イヌ'], rabbit: ['토끼', 'rabbit', 'ウサギ'], bear: ['곰', 'bear', 'クマ'], panda: ['판다', 'panda', 'パンダ'], teddy: ['테디', 'teddy', 'テディ'], bird: ['새', 'bird', '鳥'],
  cockatoo: ['앵무(코카투)', 'cockatoo', 'オウム'], parrot: ['앵무새', 'parrot', 'インコ'], siamese: ['샴', 'Siamese', 'シャム'], corgi: ['코기', 'corgi', 'コーギー'], dalmatian: ['달마시안', 'Dalmatian', 'ダルメシアン'],
  poodle: ['푸들', 'poodle', 'プードル'], shiba: ['시바', 'Shiba', '柴'], dragon: ['드래곤', 'dragon', 'ドラゴン'], frog: ['개구리', 'frog', 'カエル'], hedgehog: ['고슴도치', 'hedgehog', 'ハリネズミ'],
  turtle: ['거북이', 'turtle', 'カメ'], unicorn: ['유니콘', 'unicorn', 'ユニコーン'],
};
// Colours go last in brackets ("아프로 (검정)"); bodies read "남 · 밝은".
export function itemName(item) {
  if (!item) return '';
  const i = L();
  const word = (p) => WORDS[p]?.[i] ?? p;
  if (item.slot === 'body') return item.parts.map(word).join(' · ');
  const nouns = item.parts.filter((p) => !COLORS[p]).map(word);
  const colors = item.parts.filter((p) => COLORS[p]).map(word);
  return `${nouns.join(' ') || slotName(item.slot)}${colors.length ? ` (${colors.join(', ')})` : ''}`;
}

const src = (id) => `avatar/${id}.png`;
// A stacked portrait; size in px. The pet stands at its feet, smaller.
export function avatarNode(look = {}, size = 96) {
  const box = document.createElement('div');
  box.className = 'avatar';
  box.style.width = box.style.height = `${size}px`;
  box.setAttribute('data-no-i18n', '');
  const full = { ...DEFAULT_AVATAR, ...look };
  for (const slot of LAYERS) {
    const id = full[slot];
    if (!id || !itemById(id)) continue;
    const img = document.createElement('img');
    img.src = src(id);
    img.alt = '';
    img.draggable = false;
    box.append(img);
  }
  if (full.pet && itemById(full.pet)) {
    const pet = document.createElement('img');
    pet.className = 'avatar-pet';
    pet.src = src(full.pet);
    pet.alt = '';
    box.append(pet);
  }
  return box;
}
export const itemImage = (id) => src(id);
