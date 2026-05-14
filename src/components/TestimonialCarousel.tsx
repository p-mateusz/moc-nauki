import React, { useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    name: "Zofia K.",
    initials: "ZK",
    avatarBg: "linear-gradient(135deg,#3b82f6,#6366f1)",
    // avatar: "/avatars/zofia.jpg",
    school: "Staszic",
    badge: "Matura 2025",
    text: "W końcu nie spóźniam się z notatkami. Klikam jeden przycisk, a aplikacja sama zapisuje to, co mówi nauczyciel. Na lekcji po raz pierwszy mogłam się skupić na rozumieniu, a nie na przepisywaniu.",
  },
  {
    name: "Michał W.",
    initials: "MW",
    avatarBg: "linear-gradient(135deg,#a78bfa,#6366f1)",
    // avatar: "/avatars/michal.jpg",
    school: "Żmichowska",
    badge: "C1 Advanced",
    text: "Fiszki generowane z moich własnych tekstów to zupełnie inny poziom. Uczę się słówek w kontekście zdań, które sam czytałem — zostają w głowie znacznie dłużej niż z Quizletu.",
  },
  {
    name: "Ania P.",
    initials: "AP",
    avatarBg: "linear-gradient(135deg,#34d399,#059669)",
    school: "Królowej Jadwigi",
    badge: "Matura 2026",
    text: "Przestałam panikować przed sprawdzianami, bo wiem co i kiedy mam się uczyć. Daty kartkówek, lektury, zadania — wszystko ląduje w moim kalendarzu automatycznie.",
  },
  {
    name: "Natalia M.",
    initials: "NM",
    avatarBg: "linear-gradient(135deg,#fb7185,#f97316)",
    // avatar: "/avatars/natalia.jpg",
    school: "Słowacki",
    badge: "B2",
    text: "Przed każdym sprawdzianem z matematyki wchodzę, wpisuję temat i przerabiam dotychczasowe testy mojego nauczyciela. Nie wiem jak bez tego wcześniej żyłam.",
  },
  {
    name: "Ola R.",
    initials: "OR",
    avatarBg: "linear-gradient(135deg,#60a5fa,#34d399)",
    // avatar: "/avatars/ola.jpg",
    school: "Kopernik",
    badge: "Matura 2024",
    text: "Zaczęłam powtórkę do rozszerzonej matury z hiszpańskiego tydzień przed egzaminem. 2 godziny dziennie zdań zrobionych specjalnie pode mnie - zdałam na 83%.",
  },
];

const TestimonialCarousel: React.FC = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });

  useEffect(() => {
    if (!emblaApi) return;
    const id = setInterval(() => {
      emblaApi.scrollNext();
    }, 4200);
    return () => clearInterval(id);
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  return (
    <motion.section className="lp-section testimonials-section" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
      <div className="lp-container">
        <div className="center" style={{ marginBottom: 28 }}>
          <div className="sec-label">Opinie</div>
          <h2 className="sec-title">Co mówią <span>licealiści?</span></h2>
        </div>

        <div className="testimonial-wrap">
          <div className="embla" ref={emblaRef as any}>
            <div className="embla__container">
              {testimonials.map((t, i) => (
                <div className="embla__slide" key={i}>
                  <motion.div className="tcard carousel-card" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
                    <div className="tstars">★★★★★</div>
                    <p className="ttext">{t.text}</p>
                    <div className="tauthor">
                        {(t as any).avatar ? (
                          <img src={(t as any).avatar} alt={`${t.name} avatar`} className="tavatar-img" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} />
                        ) : (
                          <div className="tavatar" style={{ background: t.avatarBg }}>{t.initials}</div>
                        )}
                        <div>
                          <div className="tname">{t.name}</div>
                          <div className="tschool">{t.school} · <span className="tbadge">{t.badge}</span></div>
                        </div>
                      </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </div>

          <div className="carousel-controls">
            <button className="btn carousel-btn" onClick={scrollPrev} aria-label="Prev"><ChevronLeft size={18} /></button>
            <button className="btn carousel-btn" onClick={scrollNext} aria-label="Next"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default TestimonialCarousel;