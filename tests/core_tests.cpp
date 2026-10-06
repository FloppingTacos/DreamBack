#include "Feedback.h"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <stdexcept>
using namespace dreamback;
void check(bool v,const char* why) { if(!v) throw std::runtime_error(why); }
bool equal(const Image& a,const Image& b) {
    if(a.width!=b.width||a.height!=b.height) return false;
    for(std::size_t i=0;i<a.pixels.size();++i) {
        const auto p=a.pixels[i],q=b.pixels[i];
        if(p.r!=q.r||p.g!=q.g||p.b!=q.b||p.a!=q.a) return false;
    } return true;
}
int main() {
 try {
    Image source(8,8); for(int y=0;y<8;++y) for(int x=0;x<8;++x) source.at(x,y)={float(x)/8,float(y)/8,0,1};
    auto fetch=[&](int stage,Image& out) { out.pixels=source.pixels; Controls c; c.pivotX=c.pivotY=4; c.rotation=stage*.05; return c; };
    auto zero=[&](int s,Image& out) { auto c=fetch(s,out); c.feedback=0; return c; };
    check(equal(source,reconstruct(8,8,12,1,{},zero)),"zero feedback must equal source");
    check(equal(source,reconstruct(8,8,12,0,{},fetch)),"zero mix must equal source");
    check(equal(source,reconstruct(8,8,0,.5,{},fetch)),"zero depth must equal source");
    auto screen=reconstruct(8,8,4,1,{},fetch);
    check(!equal(source,screen),"opaque screen must reveal feedback");
    check(screen.at(4,4).a>.99f,"opaque screen interior alpha");
    auto rings=[](int stage,Image& out) {
        std::fill(out.pixels.begin(),out.pixels.end(),stage==0?Pixel{1,0,0,1}:stage==1?Pixel{0,1,0,1}:Pixel{0,0,1,1});
        Controls c;c.feedback=1;c.zoom=.5;c.pivotX=c.pivotY=8;return c;
    };
    auto nested=reconstruct(16,16,2,1,{},rings);
    check(nested.at(2,8).r==1&&nested.at(5,8).g==1&&nested.at(8,8).b==1,"centered zoom scales each generation and preserves exterior source");
    auto strength=[](int stage,Image& out) {
        std::fill(out.pixels.begin(),out.pixels.end(),stage==2?Pixel{0,0,1,1}:Pixel{0,0,0,1});
        Controls c;c.feedback=stage==1?.5:1;c.zoom=1;return c;
    };
    auto fade=reconstruct(4,4,2,1,{},strength);
    check(fade.at(2,2).b==.5f,"each historical stage uses its historical Feedback");
    auto half=reconstruct(8,8,4,.5,{},fetch);
    check(std::abs(half.at(3,3).r-(source.at(3,3).r+screen.at(3,3).r)*.5)<1e-6,"mix applied once after recursion");
    // A dot existed only at the oldest stage. Outer gesture +1 and historical
    // hold 0 must put it at x=2. Reusing current +1 at both stages puts it at x=3.
    auto gesture=[](int stage,Image& out) { std::fill(out.pixels.begin(),out.pixels.end(),Pixel{}); if(stage==2) out.at(1,2)={.4f,0,0,.5f}; Controls c; c.mode=Mode::Overlay; c.zoom=1; c.feedback=1; c.x=stage==0?1:0; return c; };
    auto history=reconstruct(6,6,2,1,{},gesture);
    check(history.at(2,2).r==.4f&&history.at(3,2).r==0,"historical gesture propagation and disappearing source");
    auto wrong=[&](int stage,Image& out) { auto c=gesture(stage,out); c.x=1; return c; };
    check(!equal(history,reconstruct(6,6,2,1,{},wrong)),"historical transforms must not share current controls");
    // Clockwise 90-degree rotation around center: old marker (1,0) -> (3,1).
    auto rotation=[](int stage,Image& out) { std::fill(out.pixels.begin(),out.pixels.end(),Pixel{}); if(stage==2) out.at(1,0)={.3f,0,0,.4f}; Controls c; c.mode=Mode::Overlay; c.feedback=1; c.zoom=1; c.pivotX=c.pivotY=2; c.rotation=stage==1?std::acos(-1.0)/2:0; return c; };
    auto rotated=reconstruct(4,4,2,1,{},rotation);
    check(std::abs(rotated.at(3,1).r-.3f)<1e-6&&rotated.at(1,0).r<1e-6,"rotation pulse persists after outer hold");
    Image transparent(4,4),empty(4,4),out(4,4);
    Controls c; c.zoom=1;c.feedback=.9;c.pivotX=c.pivotY=2;
    composite(transparent,empty,out,c,{}); check(equal(empty,out),"transparent history stays transparent");
    transparent.at(1,1)={.25f,.1f,0,.5f}; c.mode=Mode::Overlay;
    composite(transparent,transparent,out,c,{});
    check(std::abs(out.at(1,1).a-.95f)<1e-6&&std::abs(out.at(1,1).r-.475f)<1e-6,"premultiplied additive alpha/color");
    // Edge: geometric coverage must survive zero-alpha input.
    Image opaque(4,4);for(auto& p:opaque.pixels)p={1,1,1,1};c.mode=Mode::Screen;c.feedback=1;c.x=.5;
    composite(opaque,empty,out,c,{});
    check(out.at(0,2).a==.5f&&out.at(1,2).a==0,"geometric screen coverage separate from image alpha");
    auto early=[](int stage,Image& out) { std::fill(out.pixels.begin(),out.pixels.end(),stage>0?Pixel{}:Pixel{.5f,0,0,1}); Controls c;c.feedback=1;c.zoom=.5;c.pivotX=c.pivotY=2;return c; };
    auto first=reconstruct(4,4,12,1,{},early);
    check(first.at(0,0).a==1&&first.at(2,2).a==0,"early source uses transparent prehistory");
    auto frame=[&](int t) { return reconstruct(8,8,12,1,{},[&](int stage,Image& out) { auto c=fetch(stage,out);c.rotation=(t-stage*3)*.07;c.x=std::sin(t-stage*3);return c; }); };
    auto expected=frame(20);frame(50);frame(1);check(equal(expected,frame(20)),"out of order deterministic frames");
    bool cancelled=false;try{reconstruct(8,8,12,1,{},fetch,[]{return true;});}catch(const Cancelled&){cancelled=true;}
    check(cancelled,"cancellation");
    bool bounded=false;try{Image huge(100000,100000);}catch(const std::length_error&){bounded=true;}check(bounded,"bounded memory");
    // PAR=2: clockwise rotation moves a one-pixel horizontal displacement two rows.
    Image wide(7,7),zeroWide(7,7),wideOut(7,7);wide.at(4,3)={1,0,0,1}; c.x=0;c.zoom=1;c.pivotX=c.pivotY=3.5;c.rotation=std::acos(-1.0)/2;c.mode=Mode::Overlay;
    composite(zeroWide,wide,wideOut,c,{2});check(wideOut.at(3,5).r>.99f,"display-space pixel aspect rotation");
    std::cout<<"Core: all 19 checks passed\n";
 }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
