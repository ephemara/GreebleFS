
// K-AutoPBR HDR Encoder
// Implements RGBE encoding for valid .hdr file generation

export function encodeRGBE(imageData: ImageData): Blob {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Header
    let header = "#?RADIANCE\n";
    header += "FORMAT=32-bit_rle_rgbe\n";
    header += "GAMMA=1.0\n";
    header += "EXPOSURE=1.0\n";
    header += "\n";
    header += `-Y ${height} +X ${width}\n`;

    const headerBytes = new TextEncoder().encode(header);

    // Each pixel is 4 bytes (R, G, B, E)
    // We will use flat encoding (no RLE) for simplicity and compatibility with the simple header
    const buffer = new Uint8Array(width * height * 4);

    let bufferIdx = 0;

    for (let i = 0; i < data.length; i += 4) {
        // Convert 0-255 to 0.0-1.0 float
        const r = data[i] / 255.0;
        const g = data[i + 1] / 255.0;
        const b = data[i + 2] / 255.0;

        // Offset mapping to avoid floating point errors
        let v = r;
        if (g > v) v = g;
        if (b > v) v = b;

        if (v < 1e-32) {
            buffer[bufferIdx++] = 0;
            buffer[bufferIdx++] = 0;
            buffer[bufferIdx++] = 0;
            buffer[bufferIdx++] = 0;
        } else {
            // Frexp: mantissa * 2^exponent = v
            // We need to encode exponent + 128

            // Javascript doesn't expose frexp directly, do it manually
            // log2(v) gives us the exponent approximation
            let e = Math.ceil(Math.log2(v));
            if (e === -Infinity) e = 0; // handle log2(0)
            // Radiance uses 128 bias
            // Also need to normalize mantissa to 0.5 - 1.0 range usually, but RGBE definition is:
            // pixel = mantissa * 2^(exponent-128)
            // mantissa is stored as byte (0-255) -> value = byte/256

            // Standard conversion:
            // v = m * 2^(e - 128)
            // m = v / 2^(e - 128)
            // encoded_m = m * 256

            // Let's rely on the canonical functionality:
            // exponent = floor(log2(max_rgb)) + 128? 
            // Actually simpler: 

            // From Greg Ward's code:
            // d = max(r, g, b);
            // if (d <= 1e-32) { r=g=b=0; e=0; }
            // else {
            //   m = frexp(d, &e);
            //   d = m * 256.0 / d;
            //   r *= d; g *= d; b *= d;
            //   e += 128;
            // }

            // JS equivalent of C frexp for just the exponent:
            // Math.floor(Math.log2(n)) + 1? Not exactly because of normalized mantissa range [0.5, 1)

            // Let's use a simpler loop for exponent finding to be robust
            let exponent = Math.floor(Math.log2(v)) + 1;

            // Scale factor to map 0..1 mantissa to 0..255 byte
            // real_value = (byte + 0.5) * (2^(exp-128)) / 256 ?
            // Radiance spec: (R,G,B) * 2^(E-128)

            // So: 
            // v = scale * 2^(exponent - 128)
            // scale = v / 2^(exponent - 128)
            // scale must be < 1.0 (since we pulled out the exponent)
            // byte = scale * 256

            const scale = Math.pow(2, -exponent + 128) * 256.0;

            let rb = Math.floor(r * scale);
            let gb = Math.floor(g * scale);
            let bb = Math.floor(b * scale);
            let eb = exponent + 128;

            // Clamp just in case
            if (rb > 255) rb = 255;
            if (gb > 255) gb = 255;
            if (bb > 255) bb = 255;
            if (eb > 255) eb = 255; // Should be impossible for normal float range

            buffer[bufferIdx++] = rb;
            buffer[bufferIdx++] = gb;
            buffer[bufferIdx++] = bb;
            buffer[bufferIdx++] = eb;
        }
    }

    // Combine header and buffer
    const finalBlob = new Blob([headerBytes, buffer], { type: 'application/octet-stream' });
    return finalBlob;
}
