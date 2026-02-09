"use client";

import { Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { QUOTES } from "@/data/quotes";

export default function QuoteWidget() {
    const [quote, setQuote] = useState(QUOTES[0]);

    useEffect(() => {
        // Random quote on mount
        const randomIndex = Math.floor(Math.random() * QUOTES.length);
        setQuote(QUOTES[randomIndex]);
    }, []);

    return (
        <div style={{
            height: '100%',
            minHeight: '220px',
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: 'var(--shadow-sm)',
            transition: 'box-shadow 0.2s ease',
        }}
            className="hover-shadow"
        >
            <div style={{
                position: 'absolute',
                top: '20px',
                left: '24px',
                color: 'var(--notion-text-tertiary)',
                opacity: 0.5
            }}>
                <Quote size={24} />
            </div>

            <div style={{ padding: '0 var(--space-4)' }}>
                <p style={{
                    fontSize: '18px',
                    fontFamily: 'serif', // Or a nice serif font if available
                    fontStyle: 'italic',
                    color: 'var(--notion-text)',
                    lineHeight: '1.6',
                    marginBottom: 'var(--space-4)',
                    textAlign: 'center'
                }}>
                    "{quote?.text}"
                </p>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 'var(--space-2)'
                }}>
                    <div style={{
                        height: '1px',
                        width: '24px',
                        backgroundColor: 'var(--notion-border)',
                        marginRight: '12px'
                    }} />
                    <span style={{
                        fontSize: '13px',
                        color: 'var(--notion-text-secondary)',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {quote?.author}
                    </span>
                    <div style={{
                        height: '1px',
                        width: '24px',
                        backgroundColor: 'var(--notion-border)',
                        marginLeft: '12px'
                    }} />
                </div>
            </div>
        </div>
    );
}