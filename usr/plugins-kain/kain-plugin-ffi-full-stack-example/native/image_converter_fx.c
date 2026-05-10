#include "image_converter_fx.h"

#include <stdio.h>
#include <stdlib.h>

struct ImageConverterWorkspace {
    int width;
    int height;
};

static char G_SIGNATURE[128];

int64_t image_converter_fx_checksum(const uint8_t* pixels, size_t len) {
    int64_t checksum = 0;
    size_t index = 0;
    while (index < len) {
        checksum = (checksum * 149ll) + (int64_t)pixels[index] + (int64_t)(index % 23u);
        checksum %= 9000000000000000000ll;
        index += 1;
    }
    return checksum;
}

void image_converter_fx_tint_rgba(uint8_t* pixels, size_t len, int accent) {
    size_t index = 0;
    const uint8_t accent_u8 = (uint8_t)(accent & 0xff);
    while (index + 3 < len) {
        const uint8_t r = pixels[index + 0];
        const uint8_t g = pixels[index + 1];
        const uint8_t b = pixels[index + 2];

        pixels[index + 0] = (uint8_t)(((unsigned int)r / 2u) + ((unsigned int)accent_u8 / 2u));
        pixels[index + 1] = (uint8_t)(((unsigned int)g / 2u) + ((unsigned int)(255u - b) / 4u) + 12u);
        pixels[index + 2] = (uint8_t)(((unsigned int)b / 2u) + ((unsigned int)(255u - r) / 5u) + 20u);
        pixels[index + 3] = 255u;
        index += 4;
    }
}

const char* image_converter_fx_signature(int width, int height, int64_t checksum, int accent) {
    snprintf(
        G_SIGNATURE,
        sizeof(G_SIGNATURE),
        "image-converter-fx:%dx%d:%lld:%d",
        width,
        height,
        (long long)checksum,
        accent
    );
    return G_SIGNATURE;
}

ImageConverterWorkspace* image_converter_fx_workspace_create(int width, int height) {
    ImageConverterWorkspace* workspace = (ImageConverterWorkspace*)malloc(sizeof(ImageConverterWorkspace));
    if (!workspace) {
        return NULL;
    }
    workspace->width = width;
    workspace->height = height;
    return workspace;
}

int image_converter_fx_workspace_area(ImageConverterWorkspace* workspace) {
    if (!workspace) {
        return 0;
    }
    return workspace->width * workspace->height;
}

void image_converter_fx_workspace_destroy(ImageConverterWorkspace* workspace) {
    if (workspace) {
        free(workspace);
    }
}
