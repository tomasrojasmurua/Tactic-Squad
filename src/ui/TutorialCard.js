// Guided tutorial card (session/Tutorial.js reads/writes session.tutorial):
//   info step / tip  a centred card over a dimmed screen, with ENTENDIDO
//                    (EV.REQUEST 'tutorialOk'; LISTO, Space and Enter do the same)
//   do step          the same card docked at the left edge, out of the way of
//                    the map, the panels and the buttons: what to do now
// Both carry the step count and a way out ('tutorialSkip').
import { EV } from '../core/events.js';
import { el, setText, toggle, setHidden } from './dom.js';
import { T } from './texts.js';

export class TutorialCard {
  constructor(root, bus) {
    const F = T.flow.tutorial;
    this.backdrop = el('div', 'tut-backdrop hidden');
    this.node = el(
      'div',
      'tut-card hidden',
      `<div class="tc-head"><span class="tc-step"></span><button class="tc-skip">${T.flow.tutorialSkip}</button></div>
       <div class="tc-title"></div><div class="tc-text"></div>
       <button class="btn primary tc-ok">${F.ok}<span class="key">${F.okKey}</span></button>`,
    );
    for (const n of [this.backdrop, this.node]) n.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.step = this.node.querySelector('.tc-step');
    this.skip = this.node.querySelector('.tc-skip');
    this.title = this.node.querySelector('.tc-title');
    this.text = this.node.querySelector('.tc-text');
    this.ok = this.node.querySelector('.tc-ok');
    this.ok.addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'tutorialOk' }));
    this.skip.addEventListener('click', () => bus.emit(EV.REQUEST, { action: 'tutorialSkip' }));
    this.shownKey = '';
    root.append(this.backdrop, this.node);
  }

  update(session) {
    const t = session.tutorial;
    const id = t.tip || (t.active ? t.id : null);
    const phase = session.phase;
    // A do step is always on screen; an info step only once its card is up (its phase came).
    const visible = !!id && phase !== 'title' && phase !== 'ended' && !session.helpOpen && (t.card || (t.active && !t.info));
    toggle(this.node, 'hidden', !visible);
    toggle(this.backdrop, 'hidden', !visible || !t.card);
    if (!visible) return;
    toggle(this.node, 'drone', phase === 'drone'); // phones: clear of the drone's stick
    const dev = session.touch ? 'touch' : 'desk';
    const key = `${id}|${t.card}|${dev}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    const F = T.flow.tutorial;
    const s = t.tip ? F.tips[t.tip] : F[id];
    toggle(this.node, 'info', t.card);
    toggle(this.node, 'tip', !!t.tip);
    setText(this.step, t.tip ? F.tip : F.step(t.step + 1, t.count));
    setText(this.title, s.title);
    setText(this.text, typeof s.text === 'string' ? s.text : s.text[dev]);
    setHidden(this.ok, !t.card);
    setHidden(this.skip, !t.active);
    // A new step catches the eye (styles.css .tut-card.pop).
    this.node.classList.remove('pop');
    void this.node.offsetWidth;
    this.node.classList.add('pop');
  }
}
