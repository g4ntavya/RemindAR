/**
 * Landing Page Component
 * Editorial, bold typography design inspired by reference
 */

interface LandingPageProps {
    onStartDemo: () => void;
}

export function LandingPage({ onStartDemo }: LandingPageProps) {
    return (
        <div className="landing">
            {/* Navigation */}
            <nav className="nav">
                <div className="nav-brand">REMINDAR</div>
                <div className="nav-links">
                    <span className="nav-link">ABOUT</span>
                    <span className="nav-link">HOW IT WORKS</span>
                </div>
            </nav>

            {/* Hero */}
            <main className="hero">
                <div className="hero-content">
                    {/* Eyebrow */}
                    <p className="eyebrow">MEMORY ASSISTANT — EST. 2024</p>

                    {/* Main Headline */}
                    <h1 className="headline">
                        We help you
                        <br />
                        <span className="headline-accent">remember</span>
                        <br />
                        faces.
                    </h1>

                    {/* Description */}
                    <p className="description">
                        AI-powered face recognition that helps people with memory
                        challenges recognize loved ones and recall meaningful context.
                    </p>

                    {/* CTA Button */}
                    <button className="cta" onClick={onStartDemo}>
                        <span className="cta-text">TRY THE DEMO</span>
                        <span className="cta-arrow">→</span>
                    </button>
                </div>

                {/* Scroll indicator */}
                <div className="scroll-hint">
                    <span className="scroll-line"></span>
                    <span className="scroll-text">CAMERA REQUIRED</span>
                </div>
            </main>
        </div>
    );
}
