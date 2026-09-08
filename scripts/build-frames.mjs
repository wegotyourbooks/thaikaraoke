// Generator for data/pools.js and data/frames.js.
// A frame is written as a token list: a string starting with "{" is a slot,
// anything else is a word id. Thai and karaoke are then joined from the
// lexicon, so tone marks and token counts are correct by construction.
// Run: node scripts/build-frames.mjs && node scripts/validate-data.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const words = [];
for (let i = 1; i <= 12; i++) {
  const m = await import(join(root, 'data', `words-${String(i).padStart(2, '0')}.js`));
  words.push(...m.words);
}
const byId = new Map(words.map((w) => [w.id, w]));

// ---- pools: interchangeable words of one type ----
const POOLS = {
  V: { label: 'everyday verbs', pos: 'v', ids: [
    'w0036', 'w0037', 'w0033', 'w0034', 'w0045', 'w0166', 'w0167', 'w0157', 'w0205', 'w0206',
    'w0087', 'w0207', 'w0208', 'w0209', 'w0163', 'w0164', 'w0165', 'w0270', 'w0266', 'w0555'] },
  VMOVE: { label: 'motion verbs', pos: 'v', ids: ['w0033', 'w0034', 'w0375', 'w0226', 'w0094', 'w0093', 'w0228', 'w0229'] },
  FOOD: { label: 'food and drink', pos: 'n', ids: [
    'w0039', 'w0044', 'w0038', 'w0301', 'w0302', 'w0303', 'w0308', 'w0310', 'w0311', 'w0312',
    'w0313', 'w0314', 'w0317', 'w0319', 'w0307', 'w0305'] },
  PLACE: { label: 'places', pos: 'n', ids: [
    'w0160', 'w0162', 'w0142', 'w0143', 'w0144', 'w0238', 'w0239', 'w0240', 'w0241', 'w0242',
    'w0446', 'w0466', 'w0387', 'w0388', 'w0393', 'w0043'] },
  THING: { label: 'everyday things', pos: 'n', ids: [
    'w0272', 'w0269', 'w0416', 'w0427', 'w0428', 'w0429', 'w0171', 'w0281', 'w0161', 'w0207', 'w0265', 'w0268'] },
  ADJ: { label: 'descriptive adjectives', pos: 'adj', ids: [
    'w0040', 'w0041', 'w0042', 'w0064', 'w0065', 'w0177', 'w0179', 'w0180', 'w0181', 'w0182',
    'w0175', 'w0091', 'w0092', 'w0138', 'w0139', 'w0619'] },
  FEEL: { label: 'how you feel', pos: 'adj', ids: ['w0145', 'w0146', 'w0147', 'w0501', 'w0502', 'w0505', 'w0507', 'w0509'] },
  TIME: { label: 'time expressions', pos: 'n', ids: ['w0112', 'w0113', 'w0114', 'w0115', 'w0121', 'w0122', 'w0123', 'w0129', 'w0130', 'w0124'] },
  PERSON: { label: 'people', pos: 'pron', ids: ['w0010', 'w0012', 'w0013', 'w0014', 'w0189', 'w0190', 'w0192', 'w0193', 'w0195', 'w0196'] },
  NUM: { label: 'numbers', pos: 'num', ids: ['w0052', 'w0053', 'w0054', 'w0055', 'w0056', 'w0057', 'w0058', 'w0059', 'w0060', 'w0061'] },
  DAY: { label: 'days of the week', pos: 'n', ids: ['w0124', 'w0125', 'w0126', 'w0127', 'w0128', 'w0129', 'w0130'] },
};

// ---- frames ----
// [id-suffix, tokens, english (with {SLOT}), notes, tags]
const F = [
  // wants, needs, ability
  ['w0010 w0031 {V}', 'I want to {V}.', 'yàak + verb is the everyday "want to". No conjugation, nothing between them.', ['core']],
  ['w0010 w0005 w0031 {V}', "I don't want to {V}.", 'Negation goes before yàak, not before the verb.', ['core', 'negation']],
  ['w0010 w0032 {V}', 'I have to {V}.', 'dtɔ̂ng is obligation, and it also carries "will" — no separate future marker needed.', ['core']],
  ['w0010 {V} w0007', 'I can {V}.', 'dâai after the verb means ability or permission. Before the verb it means something else.', ['core']],
  ['w0010 {V} w0005 w0007', "I can't {V}.", 'The negation splits the verb and dâai: verb + mâi + dâai.', ['core', 'negation']],
  ['w0010 w0153 {V}', 'I used to {V}.', 'kəəi covers "have ever" — it is experience, not past tense.', ['core']],
  ['w0010 w0005 w0153 {V}', 'I never {V}.', 'mâi kəəi is the flat "never", used far more than a past-tense negative.', ['core', 'negation']],
  ['w0010 w0152 {V} w0035', 'Right now, I {V}.', 'gam-lang ... yùu wraps the verb for something in progress. Either half alone also works.', ['core']],
  ['w0010 w0151 {V}', 'I will {V}.', 'jà is optional whenever the time is already clear from context.', ['core', 'time']],
  ['w0010 w0155 {V}', 'I just {V}.', 'pə̂ng marks something that happened moments ago.', ['core', 'time']],
  ['w0010 w0154 w0005 {V}', "I haven't {V} yet.", 'yang mâi is softer than a flat no: it implies you still intend to.', ['core', 'negation']],
  ['w0010 w0201 {V}', 'I like to {V}.', 'chɔ̂ɔp takes a verb directly, with no "to".', ['core', 'feelings']],
  ['w0010 w0005 w0201 {V}', "I don't like to {V}.", 'Same shape negated: mâi goes in front of chɔ̂ɔp.', ['core', 'negation']],
  ['w0010 w0603 {V} w0069', 'Should I {V}?', 'kuan is "should"; adding mái turns it into a genuine question.', ['question']],
  // requests and offers
  ['w0150 {V} w0048', 'Please {V} (for me).', 'chûai + verb + nɔ̀i is the standard polite request. Both halves matter.', ['core']],
  ['w0046 {FOOD} w0048 w0001', 'Could I have {FOOD}, please?', 'kɔ̌ɔ + noun is the universal request in shops and restaurants.', ['food', 'core']],
  ['w0030 {FOOD} w0001', "I'll have {FOOD}.", 'ao is how you order. Direct, not rude.', ['food', 'shopping']],
  ['w0156 w0010 {V} w0069', 'Shall I {V}?', 'hâi pǒm ... offers to do something for someone.', ['question', 'core']],
  ['{V} w0077 w0534 w0069', 'Shall we {V} together?', 'gan means "together" and turns almost anything into an invitation.', ['smalltalk', 'question']],
  ['w0604 {V}', "Don't {V}.", 'yàa is the negative command. Softer than it looks when followed by ná.', ['core', 'negation']],
  // questions
  ['{PERSON} {V} w0069', 'Does {PERSON} {V}?', 'mái at the end is the neutral yes/no question. Word order never changes.', ['question']],
  ['{PERSON} {V} w0017', 'Where does {PERSON} {V}?', 'The question word sits where the answer would sit, at the end.', ['question', 'places']],
  ['{PERSON} {V} w0018', 'When does {PERSON} {V}?', 'Same rule: mʉ̂a-rài stays in the answer position.', ['question', 'time']],
  ['{PERSON} {V} w0019', 'Why does {PERSON} {V}?', 'tam-mai can also open the sentence, but the end is the safer default.', ['question']],
  ['w0021 {V}', 'Who is going to {V}?', 'krai as subject needs nothing else: no "does", no auxiliary.', ['question']],
  ['{FOOD} {ADJ} w0069', 'Is the {FOOD} {ADJ}?', 'Adjectives are verbs, so there is no "is" anywhere in this question.', ['question', 'food']],
  ['w0033 {PLACE} w0022', 'How much to {PLACE}?', 'The taxi and motorbike sentence. Say the place, then tâo-rài.', ['transport', 'money', 'question']],
  ['{PLACE} w0035 w0017', 'Where is the {PLACE}?', 'yùu is used for location, never bpen.', ['places', 'question']],
  ['{THING} w0026 w0022', 'How much is this {THING}?', 'níi comes after the noun, unlike English "this".', ['shopping', 'money', 'question']],
  ['w0080 {FOOD} w0069', 'Do you have {FOOD}?', 'mii covers both "have" and "there is".', ['food', 'question']],
  // location, time, scheduling
  ['w0010 w0035 {PLACE}', "I'm at the {PLACE}.", 'yùu plus a place needs no preposition.', ['places']],
  ['w0010 w0151 w0033 {PLACE}', "I'm going to the {PLACE}.", 'bpai plus a place, again with no "to".', ['places', 'transport']],
  ['w0010 {V} {TIME}', 'I {V} {TIME}.', 'Time can go at the end, but front is more common in speech.', ['time']],
  ['{TIME} w0010 w0151 {V}', '{TIME} I will {V}.', 'Front-loading the time is the natural Thai order.', ['time']],
  ['w0014 {V} w0111 {DAY} w0069', 'Shall we {V} on {DAY}?', 'Days need wan in front: wan jan, wan sǎo.', ['time', 'question']],
  ['w0010 w0566 {DAY}', "I'm free on {DAY}.", 'wâang is the everyday "free" for schedules.', ['time']],
  ['w0010 w0005 w0566 {DAY}', "I'm not free on {DAY}.", 'Same frame negated, which is how most declining is done.', ['time', 'negation']],
  // quantity and comparison
  ['w0046 {FOOD} {NUM} w0170', "I'll take {NUM} {FOOD}.", 'Order is noun, number, classifier — the reverse of English.', ['food', 'numbers']],
  ['{FOOD} {ADJ} w0184', 'The {FOOD} is very {ADJ}.', 'mâak follows the adjective, unlike English "very".', ['food']],
  ['{FOOD} {ADJ} w0090', 'The {FOOD} is a bit {ADJ}.', 'nít-nɔ̀i softens a complaint into something you can actually say out loud.', ['food']],
  ['{FOOD} {ADJ} w0529 w0026', 'The {FOOD} is more {ADJ} than this.', 'gwàa is the whole comparative: no "more", no "-er".', ['shopping']],
  ['{FOOD} {ADJ} w0530', 'The {FOOD} is the most {ADJ}.', 'tîi-sùt is the superlative and always follows the adjective.', ['shopping']],
  ['w0046 {ADJ} w0186 w0048', 'A bit less {ADJ}, please.', 'The standard way to adjust a dish before it is cooked.', ['food']],
  ['w0046 {FOOD} w0047 {NUM} w0170', '{NUM} more {FOOD}, please.', 'ìik means "more of the same" and comes before the number.', ['food', 'numbers']],
  // states, feelings, opinions
  ['w0010 {FEEL}', "I'm {FEEL}.", 'No verb at all: the adjective is the predicate.', ['feelings']],
  ['w0010 {FEEL} w0184', "I'm very {FEEL}.", 'Same shape with mâak after the adjective.', ['feelings']],
  ['w0010 w0005 {FEEL}', "I'm not {FEEL}.", 'mâi goes straight before the adjective, as it does before a verb.', ['feelings', 'negation']],
  ['{PERSON} {FEEL} w0069', 'Is {PERSON} {FEEL}?', 'Checking in on someone: adjective plus mái.', ['feelings', 'question']],
  ['w0010 w0109 w0554 {PERSON} {FEEL}', 'I think {PERSON} is {FEEL}.', 'wâa introduces a clause, like "that" in English.', ['opinion']],
  ['w0010 w0089 w0554 {PERSON} {V}', 'I know {PERSON} {V}.', 'Same wâa clause after rúu.', ['opinion']],
  ['{THING} w0026 {ADJ} w0184', 'This {THING} is very {ADJ}.', 'Adjective, then mâak, and still no verb "to be".', ['shopping']],
  ['w0010 w0201 {THING} w0026', 'I like this {THING}.', 'níi after the noun again.', ['shopping', 'feelings']],
  // possession and existence
  ['w0010 w0080 {THING}', 'I have a {THING}.', 'mii has no article and no plural.', ['core']],
  ['w0010 w0005 w0080 {THING}', "I don't have a {THING}.", 'The negative of mii is used constantly in shops.', ['core', 'negation']],
  ['w0080 {THING} w0069', 'Is there a {THING}?', 'Same mii, now meaning "is there".', ['question']],
  ['{THING} w0168 {PERSON}', "{PERSON}'s {THING}.", 'kɔ̌ɔng marks possession and can be dropped between close nouns.', ['core']],
  ['{THING} w0035 {PLACE}', 'The {THING} is at the {PLACE}.', 'yùu for location, one more time.', ['places']],
  // transport
  ['w0010 w0031 w0033 {PLACE}', 'I want to go to the {PLACE}.', 'The full taxi sentence in four words.', ['transport']],
  ['{VMOVE} {PLACE}', '{VMOVE} to the {PLACE}.', 'Motion verb plus destination, with nothing in between.', ['transport']],
  ['w0493 w0078 {PLACE}', 'Stop at the {PLACE}.', 'tîi is the "at" you need when the place is a landmark.', ['transport']],
  ['{PLACE} w0138 w0069', 'Is the {PLACE} far?', 'glai is far, glâi is near, and they differ only by tone.', ['transport', 'question']],
  ['w0033 {PLACE} {V} w0007 w0069', 'Can I {V} at the {PLACE}?', 'Stacking a place and a verb inside one permission question.', ['question', 'places']],
  // food and ordering
  ['w0045 {FOOD} {NUM} w0170', 'Order {NUM} {FOOD}.', 'sàng is for ordering in a restaurant; sʉ́ʉ is for buying.', ['food', 'numbers']],
  ['w0005 w0030 {FOOD}', 'No {FOOD}, please.', 'mâi ao is how you refuse an ingredient without any extra words.', ['food', 'negation']],
  ['w0010 w0005 w0036 {FOOD}', "I don't eat {FOOD}.", 'Standing dietary rules use the plain negative, not a modal.', ['food', 'negation']],
  ['{FOOD} w0026 {ADJ} w0069', 'Is this {FOOD} {ADJ}?', 'The question you ask before committing to the chilli.', ['food', 'question']],
  ['w0046 {FOOD} w0077 w0038 w0001', '{FOOD} and water, please.', 'gàp joins two nouns; it is not used to join sentences.', ['food']],
  // people and small talk
  ['{PERSON} w0081 w0189 w0010', '{PERSON} is my friend.', 'bpen links two nouns. Never use it before an adjective.', ['people']],
  ['{PERSON} w0083 w0016', "What is {PERSON}'s name?", 'Literally "name what", with the question word last.', ['people', 'question']],
  ['{PERSON} {V} w0534 w0077 w0010', '{PERSON} {V} with me.', 'gan gàp is "together with" and is extremely common.', ['people']],
  ['{PERSON} w0201 {FOOD} w0069', 'Does {PERSON} like {FOOD}?', 'A safe opener with anyone, anywhere.', ['smalltalk', 'question']],
  ['w0010 w0203 {PERSON}', 'I miss {PERSON}.', 'kít-tʉ̌ng is used far more freely than English "miss".', ['feelings', 'people']],
  // conditions and reasons
  ['w0010 {V} w0587 w0010 {FEEL}', 'I {V} because I am {FEEL}.', 'prɔ́ introduces the reason and needs nothing else.', ['core']],
  ['w0010 w0031 {V} w0076 w0005 w0007', 'I want to {V} but I cannot.', 'dtɛ̀ɛ joins the two halves exactly where English "but" would.', ['core']],
  ['w0010 {V} w0050', 'I already {V}.', 'lɛ́ɛo at the end marks the change of state, not the past.', ['core', 'time']],
  ['w0010 {V} w0050 w0069', 'Did you {V} yet?', 'lɛ́ɛo plus mái is the standard "have you yet".', ['question', 'time']],
  ['{PERSON} {V} w0073 w0007', '{PERSON} can {V} too.', 'gɔ̂ dâai means "that works too" and softens any suggestion.', ['core']],
  ['w0010 {V} w0490 w0005 w0007', "I really can't {V} at all.", 'ləəi after a negative intensifies it to "at all".', ['core', 'negation']],
  ['w0010 w0031 w0033 {PLACE} w0077 w0189', 'I want to go to the {PLACE} with a friend.', 'gàp is "with" for company as well as for joining nouns.', ['places', 'smalltalk']],
  ['{PERSON} w0033 {PLACE} w0050 w0069', 'Has {PERSON} gone to the {PLACE} yet?', 'lɛ́ɛo mái asks whether something has happened, with no tense anywhere.', ['question', 'places']],
];

const pools = Object.entries(POOLS).map(([id, p]) => {
  for (const wid of p.ids) if (!byId.has(wid)) throw new Error(`pool ${id}: unknown word ${wid}`);
  return { id, label: p.label, pos: p.pos, wordIds: p.ids };
});

const frames = F.map((spec, i) => {
  const [tokens, en, notes, tags] = spec;
  const slots = {};
  const th = [], ka = [];
  for (const tok of tokens.split(' ')) {
    if (tok.startsWith('{')) {
      const name = tok.slice(1, -1);
      if (!POOLS[name]) throw new Error(`frame ${i}: unknown pool ${name}`);
      if (slots[name]) throw new Error(`frame ${i}: pool ${name} used twice`);
      slots[name] = name;
      th.push(tok); ka.push(tok);
      continue;
    }
    const w = byId.get(tok);
    if (!w) throw new Error(`frame ${i}: unknown word ${tok}`);
    th.push(w.thai); ka.push(w.karaoke);
  }
  if (!Object.keys(slots).length) throw new Error(`frame ${i}: no slots`);
  for (const name of Object.keys(slots)) {
    if (!en.includes('{' + name + '}')) throw new Error(`frame ${i}: english is missing {${name}}`);
  }
  return {
    id: 'fr' + String(i + 1).padStart(2, '0'),
    th: th.join(' '), karaoke: ka.join(' '), en,
    slots: Object.keys(slots), notes, tags,
  };
});

const j = JSON.stringify;
writeFileSync(join(root, 'data', 'pools.js'),
  `// ThaiKaraoke data: typed word pools for the sentence-frame engine.
// Every id is an existing lexicon word; a frame slot draws only from its pool,
// and only from words the learner has already met.
// Generated by scripts/build-frames.mjs — edit the generator, not this file.
export const pools = [
${pools.map((p) => `  { id:${j(p.id)}, label:${j(p.label)}, pos:${j(p.pos)}, wordIds:${j(p.wordIds)} },`).join('\n')}
];
`);

writeFileSync(join(root, 'data', 'frames.js'),
  `// ThaiKaraoke data: ${frames.length} sentence frames.
// A frame is a real sentence with one or more slots ({V}, {FOOD}, ...). Slots
// are filled from data/pools.js, and the engine only ever uses words whose card
// is no longer new, so a drill never introduces vocabulary you have not met.
// Generated by scripts/build-frames.mjs — edit the generator, not this file.
export const frames = [
${frames.map((f) => `  { id:${j(f.id)}, th:${j(f.th)}, karaoke:${j(f.karaoke)}, en:${j(f.en)}, slots:${j(f.slots)}, notes:${j(f.notes)}, tags:${j(f.tags)} },`).join('\n')}
];
`);
console.log(`wrote data/pools.js (${pools.length} pools) and data/frames.js (${frames.length} frames)`);
