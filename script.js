// Intersection Observer for Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
    // Observe fade-in elements
    const elements = document.querySelectorAll('.fade-in-up');
    elements.forEach(el => observer.observe(el));

    // Also observe glass cards for consistency if we wanted animations on them
    const cards = document.querySelectorAll('.service-card');
    cards.forEach((card, index) => {
        card.classList.add('fade-in-up');
        card.style.transitionDelay = `${index * 0.1}s`; // Stagger
        observer.observe(card);
    });
});

// Sticky Navbar Logic
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

/* =========================================
   REPAIR — scroll-driven motion design
   Scroll position → smoothed progress p (0..1) → "frame position" fp (0..3)
   Everything (camera, dissolve, captions, HUD, rail, %) is derived from p.
   ========================================= */
(function () {
    const sec = document.querySelector('[data-repair]');
    if (!sec) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stage = sec.querySelector('[data-stage]');
    const frames = [...sec.querySelectorAll('.repair-frame')];
    const caps = [...sec.querySelectorAll('.repair-cap')];
    const spots = [...sec.querySelectorAll('.repair-spot')];
    const ticks = [...sec.querySelectorAll('.repair-tick')];
    const intro = sec.querySelector('.repair-intro');
    const scan = sec.querySelector('.repair-scan');
    const glint = sec.querySelector('.repair-glint');
    const railFill = sec.querySelector('.repair-rail-fill');
    const pct = sec.querySelector('[data-pct]');
    const bar = sec.querySelector('.repair-readout .bar i');
    const readout = sec.querySelector('.repair-readout');

    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const smooth = t => t * t * (3 - 2 * t);               // smoothstep
    const range = (v, a, b) => clamp((v - a) / (b - a));   // 0..1 inside [a,b]

    // Holds and transitions: [scroll progress, frame position]
    const KEYS = [[0, 0], [0.22, 0], [0.32, 1], [0.46, 1], [0.56, 2], [0.70, 2], [0.80, 3], [1, 3]];
    function framePos(p) {
        for (let i = 1; i < KEYS.length; i++) {
            const [p0, f0] = KEYS[i - 1], [p1, f1] = KEYS[i];
            if (p <= p1) return f0 + (f1 - f0) * smooth(range(p, p0, p1));
        }
        return 3;
    }

    let target = 0, cur = 0;
    let mx = 0, my = 0, cmx = 0, cmy = 0;
    let raf = 0, visible = false;

    function measure() {
        const r = sec.getBoundingClientRect();
        const total = sec.offsetHeight - window.innerHeight;
        target = clamp(-r.top / total);
    }

    function render(p) {
        const fp = framePos(p);
        const base = Math.min(3, Math.floor(fp));
        const t = fp - base;

        // 1. Frames: blur-dissolve + exposure flash on the incoming frame
        frames.forEach((f, i) => {
            let o = 0, filter = 'none';
            if (i === base) o = 1;
            else if (i === base + 1 && t > 0.001) {
                o = t;
                if (!reduce) {
                    const blur = (1 - t) * 14;
                    const flash = 1 + Math.sin(t * Math.PI) * 0.35;
                    filter = `blur(${blur.toFixed(2)}px) brightness(${flash.toFixed(3)})`;
                }
            }
            f.style.opacity = o;
            f.style.filter = filter;
        });

        // 2. Camera: slow dolly-in over the whole sequence + a push at each cut
        const push = reduce ? 0 : Math.sin(t * Math.PI) * 0.045;
        const s = 1.22 - 0.2 * smooth(p) + push;
        stage.style.setProperty('--s', s.toFixed(4));
        stage.style.setProperty('--mx', cmx.toFixed(2) + 'px');
        stage.style.setProperty('--my', cmy.toFixed(2) + 'px');

        // 3. Intro title leaves, step captions take over
        const introO = 1 - range(p, 0.02, 0.09);
        intro.style.opacity = introO;
        intro.style.transform = `translateY(${(-60 * (1 - introO)).toFixed(1)}px)`;
        intro.style.filter = reduce ? 'none' : `blur(${(8 * (1 - introO)).toFixed(1)}px)`;

        caps.forEach((c, i) => {
            const d = fp - i;
            let o = clamp(1 - Math.abs(d) * 2.4);
            if (i === 0) o *= range(p, 0.08, 0.14);
            c.style.opacity = o;
            c.style.transform = `translateY(calc(${c.dataset.base || '-50%'} + ${(-d * 46).toFixed(1)}px))`;
            c.style.filter = reduce ? 'none' : `blur(${(Math.abs(d) * 7).toFixed(1)}px)`;
            c.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
            c.setAttribute('aria-hidden', o < 0.5);
        });

        // 4. HUD callouts — only during the hold of their frame
        spots.forEach((sp, i) => {
            let o = clamp(1 - Math.abs(fp - i) * 4);
            if (i === 0) o *= range(p, 0.10, 0.13);
            sp.style.opacity = o;
            sp.classList.toggle('is-on', o > 0.6);
        });

        // 5. Diagnostic scan (frame 1) and screen glint (frame 4)
        const sp = range(p, 0.08, 0.21);
        scan.style.opacity = sp > 0 && sp < 1 ? Math.sin(sp * Math.PI) : 0;
        scan.style.setProperty('--scan', sp.toFixed(4));
        const g = range(p, 0.83, 0.95);
        glint.style.setProperty('--glint', g.toFixed(4));
        glint.style.setProperty('--glint-o', (Math.sin(g * Math.PI)).toFixed(3));

        // 6. Progress rail, ticks, live percentage
        railFill.style.transform = `scaleY(${(fp / 3).toFixed(4)})`;
        ticks.forEach((tk, i) => tk.classList.toggle('is-on', fp >= i - 0.35));
        const percent = Math.round((fp / 3) * 100);
        pct.textContent = String(percent).padStart(3, '0');
        bar.style.transform = `scaleX(${(fp / 3).toFixed(4)})`;
        readout.style.opacity = range(p, 0.05, 0.12);
    }

    function tick() {
        const k = reduce ? 1 : 0.085;
        cur += (target - cur) * k;
        cmx += (mx - cmx) * 0.06;
        cmy += (my - cmy) * 0.06;
        render(cur);
        const settled = Math.abs(target - cur) < 0.0002 && Math.abs(mx - cmx) < 0.05 && Math.abs(my - cmy) < 0.05;
        raf = (visible && !settled) ? requestAnimationFrame(tick) : 0;
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

    // Mobile captions are anchored bottom, not centred
    const mq = window.matchMedia('(max-width: 768px), (max-aspect-ratio: 4/5)');
    const setBase = () => caps.forEach(c => c.dataset.base = mq.matches ? '0px' : '-50%');
    setBase();
    mq.addEventListener ? mq.addEventListener('change', setBase) : mq.addListener(setBase);

    new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) { measure(); wake(); }
    }, { rootMargin: '200px 0px' }).observe(sec);

    window.addEventListener('scroll', () => { if (visible) { measure(); wake(); } }, { passive: true });
    window.addEventListener('resize', () => { measure(); wake(); });

    // Subtle parallax with the mouse (desktop only)
    if (!reduce && window.matchMedia('(pointer: fine)').matches) {
        sec.addEventListener('mousemove', e => {
            mx = (e.clientX / window.innerWidth - 0.5) * -22;
            my = (e.clientY / window.innerHeight - 0.5) * -14;
            wake();
        });
        sec.addEventListener('mouseleave', () => { mx = my = 0; wake(); });
    }

    measure();
    cur = target;
    render(cur);
})();
