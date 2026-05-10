#if defined(_WIN32)
#define IMAGE_CONVERTER_FX_EXPORT __declspec(dllexport)
#else
#define IMAGE_CONVERTER_FX_EXPORT
#endif

#include <stddef.h>
#include <stdint.h>

typedef struct ImageConverterWorkspace ImageConverterWorkspace;

IMAGE_CONVERTER_FX_EXPORT int64_t image_converter_fx_checksum(const uint8_t* pixels, size_t len);
IMAGE_CONVERTER_FX_EXPORT void image_converter_fx_tint_rgba(uint8_t* pixels, size_t len, int accent);
IMAGE_CONVERTER_FX_EXPORT const char* image_converter_fx_signature(int width, int height, int64_t checksum, int accent);
IMAGE_CONVERTER_FX_EXPORT ImageConverterWorkspace* image_converter_fx_workspace_create(int width, int height);
IMAGE_CONVERTER_FX_EXPORT int image_converter_fx_workspace_area(ImageConverterWorkspace* workspace);
IMAGE_CONVERTER_FX_EXPORT void image_converter_fx_workspace_destroy(ImageConverterWorkspace* workspace);
