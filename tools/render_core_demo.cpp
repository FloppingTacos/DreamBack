// Host-independent visual smoke test using the exact same reconstruction core.
#include "../src/core/Feedback.h"
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <sstream>
using namespace dreamback;
int main(int argc,char** argv) {
    const std::string directory=argc>1?argv[1]:"build/preview";
    constexpr int w=480,h=270;
    for(int frame=0;frame<75;++frame) {
        const int current=frame+15;
        auto image=reconstruct(w,h,12,1,{},[&](int stage,Image& source) {
            const int t=current-stage*3;
            const double phase=t/30.0;
            for(int y=0;y<h;++y)for(int x=0;x<w;++x) {
                Pixel p;
                if(t>=0) {
                    p={.012f,.018f,.035f,1};
                    if((x>=19&&x<461&&(y>=19&&y<23||y>=247&&y<251))||
                       (y>=19&&y<251&&(x>=19&&x<23||x>=457&&x<461))) p={.06f,.8f,1,1};
                    if(x>=40&&x<85&&y>=38&&y<60||x>=40&&x<55&&y>=38&&y<85)p={1,.18f,.08f,1};
                    const double cx=240+130*std::sin(phase*2),cy=180+35*std::cos(phase*1.3);
                    if(std::abs(x-cx)<13&&std::abs(y-cy)<13)p={.3f,1,.2f,1};
                    if(t>=75&&t<90&&x>=280&&x<355&&y>=50&&y<75)p={1,.75f,.04f,1};
                }
                source.at(x,y)=p;
            }
            Controls c;c.pivotX=w*.5;c.pivotY=h*.5;
            // Gesture goes left, right, then holds at zero.
            if(t>=30&&t<36)c.rotation=(t-30)/6.0*.28;
            else if(t>=36&&t<42)c.rotation=.28-(t-36)/6.0*.49;
            else if(t>=42&&t<48)c.rotation=-.21+(t-42)/6.0*.21;
            if(t>=60&&t<66)c.x=(t-60)*4;
            else if(t>=66&&t<72)c.x=24-(t-66)*7;
            else if(t>=72&&t<78)c.x=-18+(t-72)*3;
            return c;
        });
        std::ostringstream path;path<<directory<<"/frame-"<<std::setfill('0')<<std::setw(3)<<frame<<".ppm";
        std::ofstream f(path.str(),std::ios::binary);f<<"P6\n"<<w<<' '<<h<<"\n255\n";
        for(auto p:image.pixels) {unsigned char rgb[3]={static_cast<unsigned char>(std::lround(std::clamp(p.r,0.f,1.f)*255)),static_cast<unsigned char>(std::lround(std::clamp(p.g,0.f,1.f)*255)),static_cast<unsigned char>(std::lround(std::clamp(p.b,0.f,1.f)*255))};f.write(reinterpret_cast<char*>(rgb),3);}
        if(!f) return 1;
    }
}
