#pragma once
#include <cstddef>
#include <functional>
#include <vector>

namespace dreamback {
// Linear arithmetic in the host's working color space; premultiplied RGBA.
struct Pixel { float r=0, g=0, b=0, a=0; };
struct Image {
    int width=0, height=0;
    std::vector<Pixel> pixels;
    Image(int w, int h);
    Pixel& at(int x,int y) { return pixels[std::size_t(y)*width+x]; }
    const Pixel& at(int x,int y) const { return pixels[std::size_t(y)*width+x]; }
};
enum class Mode { Screen, Overlay };
struct Controls {
    Mode mode=Mode::Screen;
    double feedback=.9, zoom=.9, rotation=0; // rotation in radians, clockwise
    double x=0, y=0, pivotX=0, pivotY=0; // rendered pixel coordinates
};
struct Geometry { double pixelAspect=1; }; // displayed width / height of a rendered pixel
struct Cancelled {};
using Abort = std::function<bool()>;
using Fetch = std::function<Controls(int stage, Image& source)>;
// Three float images total, regardless of depth. Fetch stage 0 is current,
// stage N is N delays ago. Invalid history must fill transparent black.
Image reconstruct(int width, int height, int depth, double mix,
                  Geometry geometry, const Fetch& fetch, const Abort& abort={});
// One recursive stage, useful for isolated image-processing tests.
void composite(const Image& source, const Image& prior, Image& output,
               Controls controls, Geometry geometry, const Abort& abort={});
}
