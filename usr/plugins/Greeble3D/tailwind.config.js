/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // all lowercase aesthetic - muted, dark, rebellious
                bg: {
                    DEFAULT: '#0a0a0a',
                    secondary: '#111111',
                    tertiary: '#1a1a1a',
                    elevated: '#222222',
                },
                fg: {
                    DEFAULT: '#e5e5e5',
                    muted: '#888888',
                    subtle: '#555555',
                },
                accent: {
                    DEFAULT: '#00f0ff', // Cyberpunk Cyan
                    muted: '#00a0aa',
                    subtle: '#003333',
                    foreground: '#000000',
                },
                border: {
                    DEFAULT: '#2a2a2a',
                    muted: '#1f1f1f',
                },
                // Shadcn UI Aliases
                background: '#0a0a0a',
                foreground: '#e5e5e5',
                card: {
                    DEFAULT: '#111111',
                    foreground: '#e5e5e5',
                },
                popover: {
                    DEFAULT: '#0a0a0a',
                    foreground: '#e5e5e5',
                },
                primary: {
                    DEFAULT: '#e5e5e5',
                    foreground: '#0a0a0a',
                },
                secondary: {
                    DEFAULT: '#222222',
                    foreground: '#e5e5e5',
                },
                muted: {
                    DEFAULT: '#1a1a1a',
                    foreground: '#888888',
                },
                destructive: {
                    DEFAULT: '#ef4444',
                    foreground: '#ffffff',
                },
                input: '#2a2a2a',
                ring: '#00f0ff',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Consolas', 'monospace'],
            },
            fontSize: {
                // lowercase feel - slightly smaller, tighter
                'xs': ['0.75rem', { lineHeight: '1rem' }],
                'sm': ['0.875rem', { lineHeight: '1.25rem' }],
                'base': ['1rem', { lineHeight: '1.5rem' }],
                'lg': ['1.125rem', { lineHeight: '1.75rem' }],
                'xl': ['1.25rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.5rem', { lineHeight: '2rem' }],
                '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
                '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
                '5xl': ['3rem', { lineHeight: '1' }],
            },
            spacing: {
                '18': '4.5rem',
                '22': '5.5rem',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
