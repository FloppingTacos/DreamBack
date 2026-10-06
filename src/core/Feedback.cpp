#include "Feedback.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <utility>

namespace dreamback {
namespace {
constexpr std::size_t maxPixels=11'000'000; // < 504 MiB for the three scratch images
float unit(double x) { return float(std::clamp(x,0.0,1.0)); }
Pixel add(Pixel p,Pixel q,float weight) {
    return {p.r+q.r*weight,p.g+q.g*weight,p.b+q.b*weight,p.a+q.a*weight};
}
Pixel scale(Pixel p,float s) { return {p.r*s,p.g*s,p.b*s,p.a*s}; }
void poll(const Abort& abort,int row) { if (row%32==0 && abort && abort()) throw Cancelled{}; }
struct Sample { Pixel color; float coverage=0; };
Sample sample(const Image& image,double x,double y) {
    Sample s;
    // Avoid conversion overflow, and reject samples with no possible tap.
    if (!std::isfinite(x)||!std::isfinite(y)||x<=-1||y<=-1||x>=image.width||y>=image.height) return s;
    const int ix=int(std::floor(x)), iy=int(std::floor(y));
    const float fx=float(x-ix),fy=float(y-iy);
    for(int j=0;j<2;++j) for(int i=0;i<2;++i) {
        const int px=ix+i,py=iy+j;
        const float weight=(i?fx:1-fx)*(j?fy:1-fy);
        if(px>=0&&py>=0&&px<image.width&&py<image.height) {
            s.color=add(s.color,image.at(px,py),weight);
            s.coverage+=weight; // geometric coverage, independent of image alpha
        }
    }
    return s;
}
}
Image::Image(int w,int h):width(w),height(h) {
    if(w<=0||h<=0||std::size_t(w)>maxPixels/std::size_t(h)) throw std::length_error("DreamBack frame exceeds scratch memory limit");
    pixels.resize(std::size_t(w)*h);
}
void composite(const Image& source,const Image& prior,Image& output,Controls c,Geometry g,const Abort& abort) {
    if(source.width!=prior.width||source.height!=prior.height||output.width!=source.width||output.height!=source.height)
        throw std::invalid_argument("Image dimensions differ");
    if(!std::isfinite(g.pixelAspect)||g.pixelAspect<=0) throw std::invalid_argument("Invalid pixel aspect");
    const float f=unit(c.feedback);
    const bool transform=std::isfinite(c.zoom)&&c.zoom>1e-6&&std::isfinite(c.rotation)&&
        std::isfinite(c.x)&&std::isfinite(c.y)&&std::isfinite(c.pivotX)&&std::isfinite(c.pivotY);
    const double co=std::cos(c.rotation),si=std::sin(c.rotation);
    for(int y=0;y<source.height;++y) {
        poll(abort,y);
        for(int x=0;x<source.width;++x) {
            const Pixel s=source.at(x,y);
            if(!f||!transform) { output.at(x,y)=s; continue; }
            // Inverse affine transform in displayed square-pixel space.
            const double dx=(x+.5-c.pivotX-c.x)*g.pixelAspect,dy=y+.5-c.pivotY-c.y;
            const double ux=(co*dx+si*dy)/c.zoom/g.pixelAspect+c.pivotX-.5;
            const double uy=(-si*dx+co*dy)/c.zoom+c.pivotY-.5;
            const Sample t=sample(prior,ux,uy);
            Pixel p;
            if(c.mode==Mode::Screen) {
                p=add(scale(s,1-f*t.coverage),t.color,f);
            } else {
                p=add(s,t.color,f);
                p.a=unit(p.a);
                // Bounded additive premultiplied result, including union-like
                // additive alpha so trails survive compositing over another layer.
                p.r=std::clamp(p.r,0.0f,p.a); p.g=std::clamp(p.g,0.0f,p.a); p.b=std::clamp(p.b,0.0f,p.a);
            }
            output.at(x,y)=p;
        }
    }
}
Image reconstruct(int w,int h,int depth,double mix,Geometry g,const Fetch& fetch,const Abort& abort) {
    if(depth<0||depth>32) throw std::invalid_argument("Depth outside 0..32");
    Image prior(w,h),next(w,h),source(w,h);
    const float m=unit(mix);
    if(!m) { if(abort&&abort()) throw Cancelled{}; fetch(0,prior); return prior; }
    fetch(depth,prior); // F0 at oldest required time
    for(int stage=depth-1;stage>=0;--stage) {
        if(abort&&abort()) throw Cancelled{};
        const Controls c=fetch(stage,source);
        composite(source,prior,next,c,g,abort);
        prior.pixels.swap(next.pixels);
    }
    if(m<1 && depth>0) for(int y=0;y<h;++y) {
        poll(abort,y);
        for(int x=0;x<w;++x) prior.at(x,y)=add(scale(source.at(x,y),1-m),prior.at(x,y),m);
    }
    return prior;
}
}
