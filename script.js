/* ============================================
   SOUFIANE MAJD — Portfolio JavaScript
   Particles, Typing, Scroll Reveals, Navigation
   ============================================ */

(function () {
    'use strict';

    // ---------- Particle Canvas ----------
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null };
    let animFrame;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.4 + 0.1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(108, 92, 231, ${this.opacity})`;
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        const count = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 120);
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    }

    function drawLines() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(108, 92, 231, ${0.06 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        drawLines();
        animFrame = requestAnimationFrame(animateParticles);
    }

    resizeCanvas();
    initParticles();
    animateParticles();

    window.addEventListener('resize', () => {
        resizeCanvas();
        initParticles();
    });

    // ---------- Cursor Glow ----------
    const cursorGlow = document.getElementById('cursorGlow');
    document.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top = e.clientY + 'px';
    });

    // ---------- Navbar Scroll ----------
    const navbar = document.getElementById('navbar');
    const sections = document.querySelectorAll('.section, .hero');
    const navLinks = document.querySelectorAll('.nav-link');

    function onScroll() {
        // Scrolled state
        navbar.classList.toggle('scrolled', window.scrollY > 50);

        // Active section highlighting
        let current = '';
        sections.forEach(section => {
            const top = section.offsetTop - 200;
            if (window.scrollY >= top) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === current);
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ---------- Mobile Nav Toggle ----------
    const navToggle = document.getElementById('navToggle');
    const navLinksContainer = document.getElementById('navLinks');

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinksContainer.classList.toggle('active');
    });

    navLinksContainer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinksContainer.classList.remove('active');
        });
    });

    // ---------- Typing Effect ----------
    const typingEl = document.getElementById('typingText');
    const titles = [
        'Full-Stack Developer',
        'Network & Security Specialist',
        'Cloud Computing Enthusiast',
        'Computer Engineering Student'
    ];
    let titleIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let typeSpeed = 80;

    function typeWriter() {
        const current = titles[titleIdx];
        if (isDeleting) {
            typingEl.textContent = current.substring(0, charIdx - 1);
            charIdx--;
            typeSpeed = 40;
        } else {
            typingEl.textContent = current.substring(0, charIdx + 1);
            charIdx++;
            typeSpeed = 80;
        }

        if (!isDeleting && charIdx === current.length) {
            isDeleting = true;
            typeSpeed = 2000; // pause at end
        } else if (isDeleting && charIdx === 0) {
            isDeleting = false;
            titleIdx = (titleIdx + 1) % titles.length;
            typeSpeed = 400;
        }

        setTimeout(typeWriter, typeSpeed);
    }

    typeWriter();

    // ---------- Scroll Reveal ----------
    const revealEls = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    revealEls.forEach(el => revealObserver.observe(el));

    // ---------- Stat Counter Animation ----------
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');

    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target, 10);
                animateCounter(el, target);
                counterObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => counterObserver.observe(el));

    function animateCounter(el, target) {
        let current = 0;
        const step = Math.ceil(target / 40);
        const interval = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(interval);
            }
            el.textContent = current;
        }, 35);
    }

    // ---------- Contact Form ----------
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            const originalHTML = btn.innerHTML;

            // Collect form data
            const name = document.getElementById('formName').value.trim();
            const email = document.getElementById('formEmail').value.trim();
            const message = document.getElementById('formMessage').value.trim();

            if (!name || !email || !message) return;

            // Show loading state
            btn.innerHTML = '<span>Sending...</span> <i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;

            try {
                // Remplacer "YOUR_ACCESS_KEY_HERE" par la clé que vous recevrez par email
                const res = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        access_key: "27b727b4-7f44-4259-9631-671ed8a78710",
                        name: name, 
                        email: email, 
                        message: message,
                        subject: "Nouveau message du Portfolio",
                        from_name: "Portfolio Soufiane Majd"
                    })
                });
                const data = await res.json();

                if (res.status === 200) {
                    btn.innerHTML = '<span>Message Sent!</span> <i class="fas fa-check"></i>';
                    btn.style.background = 'linear-gradient(135deg, #00cec9, #00b894)';
                    contactForm.reset();
                } else {
                    btn.innerHTML = '<span>Error — Try Again</span> <i class="fas fa-times"></i>';
                    btn.style.background = 'linear-gradient(135deg, #fd79a8, #e84393)';
                }
            } catch (err) {
                btn.innerHTML = '<span>Error — Try Again</span> <i class="fas fa-times"></i>';
                btn.style.background = 'linear-gradient(135deg, #fd79a8, #e84393)';
            }

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
                btn.disabled = false;
            }, 3000);
        });
    }

    // ---------- Smooth Scroll for CTA buttons ----------
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                targetEl.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // ---------- Gallery Filtering ----------
    const filterBtns = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filterValue = btn.getAttribute('data-filter');

            galleryItems.forEach(item => {
                const category = item.getAttribute('data-category');
                if (filterValue === 'all' || filterValue === category) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 50);
                } else {
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        if(btn.classList.contains('active')){
                            item.style.display = 'none';
                        }
                    }, 300);
                }
            });
        });
    });

    // ---------- Profile Image Fallback ----------
    const profileImg = document.getElementById('profileImage');
    if (profileImg) {
        profileImg.addEventListener('error', () => {
            // Create a gradient placeholder with initials
            const wrapper = profileImg.parentElement;
            profileImg.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.style.cssText = `
                width: 100%; height: 100%; border-radius: 50%;
                background: linear-gradient(135deg, #6c5ce7, #00cec9);
                display: flex; align-items: center; justify-content: center;
                font-size: 3rem; font-weight: 800; color: #fff;
                font-family: 'Inter', sans-serif; letter-spacing: 2px;
            `;
            placeholder.textContent = 'SM';
            wrapper.insertBefore(placeholder, profileImg);
        });
    }

})();
