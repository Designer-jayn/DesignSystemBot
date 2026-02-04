
// 1. HEX -> HSL 변환
function hexToHsl(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l };
}

// 2. HSL -> HEX 변환
function hslToHex(h, s, l) {
    l = Math.min(1, Math.max(0, l));
    s /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    const toHex = (x) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

// 3. 팔레트 생성 로직 (isVisible 속성 추가됨)
export const calculatePalette = (inputHex) => {
    const { h, s, l } = hexToHsl(inputHex);
    let targetLevel = Math.round(l * 10) * 100;
    if (targetLevel < 100) targetLevel = 100;
    if (targetLevel > 900) targetLevel = 900;

    const levels = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    const palette = [];

    levels.forEach(level => {
        const newL = level / 1000;
        const calculatedHex = hslToHex(h, s, newL);

        palette.push({
            level: level,
            hex: calculatedHex,
            isTarget: level === targetLevel,
            isVisible: true // 🔥 [추가됨] 기본적으로 보임 상태
        });
    });

    return { palette, targetLevel };
};