#include "AEConfig.h"
#include "AE_Effect.h"
#include "AE_EffectCB.h"
#include "AE_EffectCBSuites.h"
#include "AE_GeneralPlug.h"
#include "entry.h"
#include "AE_Macros.h"
#include "Param_Utils.h"
#include "Metadata.h"
#include "../core/Feedback.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <limits>
#include <memory>
#include <stdexcept>

namespace {
using namespace dreamback;
enum Param { Input, ModeParam, Delay, Depth, Feedback, Zoom, Position, Rotation, Pivot, Mix, Count };
void require(PF_Err e) { if(e) throw e; }
void fail(PF_OutData* out,const char* text) {
    std::snprintf(out->return_msg,sizeof(out->return_msg),"DreamBack: %s",text);
    out->out_flags|=PF_OutFlag_DISPLAY_ERROR_MESSAGE;
    throw PF_Err(PF_Err_BAD_CALLBACK_PARAM);
}
template<class T> class Suite {
    SPBasicSuite* basic;const char* name;A_long version;
public:
    const T* ptr=nullptr;
    Suite(PF_InData* in,const char* n,A_long v):basic(in->pica_basicP),name(n),version(v) {
        require(basic->AcquireSuite(n,v,reinterpret_cast<const void**>(&ptr)));
    }
    ~Suite() { basic->ReleaseSuite(name,version); }
    const T* operator->() const { return ptr; }
};
class Parameter {
    PF_InData* in;bool live=false;
public:
    PF_ParamDef value{};
    Parameter(PF_InData* i,int index,A_long time):in(i) {
        require(PF_CHECKOUT_PARAM(in,index,time,in->time_step,in->time_scale,&value));live=true;
    }
    ~Parameter() { if(live) PF_CHECKIN_PARAM(in,&value); }
    void close() { live=false;require(PF_CHECKIN_PARAM(in,&value)); }
};
double scalar(PF_InData* in,int index,A_long time) {
    Parameter p(in,index,time);double v=p.value.u.fs_d.value;p.close();return v;
}
int integer(PF_InData* in,int index,A_long time) {
    Parameter p(in,index,time);int v=p.value.u.sd.value;p.close();return v;
}
Controls controls(PF_InData* in,A_long time) {
    Controls c;
    {Parameter p(in,ModeParam,time);c.mode=p.value.u.pd.value==2?Mode::Overlay:Mode::Screen;p.close();}
    c.feedback=scalar(in,Feedback,time)/100;c.zoom=scalar(in,Zoom,time)/100;
    {Parameter p(in,Rotation,time);c.rotation=p.value.u.ad.value/65536.0*std::acos(-1.0)/180;p.close();}
    // AE point checkouts have already been downsampled. Subtract upstream
    // origin adjustment because the core operates in original layer coordinates.
    {Parameter p(in,Position,time);c.x=p.value.u.td.x_value/65536.0-in->pre_effect_source_origin_x;
        c.y=p.value.u.td.y_value/65536.0-in->pre_effect_source_origin_y;p.close();}
    {Parameter p(in,Pivot,time);c.pivotX=p.value.u.td.x_value/65536.0-in->pre_effect_source_origin_x;
        c.pivotY=p.value.u.td.y_value/65536.0-in->pre_effect_source_origin_y;p.close();}
    return c;
}
struct Stage { A_long time=0;int id=0;bool valid=false;Controls c; };
struct Plan { int w=0,h=0,depth=0;double mix=1;Geometry geometry;Stage stages[33]; };
void deletePlan(void* p) { delete static_cast<Plan*>(p); }
PF_Err params(PF_InData* in_data,PF_OutData* out_data) {
    PF_ParamDef def{};
    PF_ADD_POPUP("Mode",2,1,"Screen|Overlay",ModeParam);
    def={};def.flags=PF_ParamFlag_CANNOT_TIME_VARY;PF_ADD_SLIDER("Delay (frames)",1,120,1,30,3,Delay);
    def={};def.flags=PF_ParamFlag_CANNOT_TIME_VARY;PF_ADD_SLIDER("Depth",1,32,1,32,12,Depth);
    PF_ADD_FLOAT_SLIDERX("Feedback",0,100,0,100,90,1,PF_ValueDisplayFlag_PERCENT,0,Feedback);
    PF_ADD_FLOAT_SLIDERX("Zoom",1,200,10,120,90,1,PF_ValueDisplayFlag_PERCENT,0,Zoom);
    def={};PF_ADD_POINT("Position",0,0,FALSE,Position);
    def={};PF_ADD_ANGLE("Rotation",0,Rotation);
    def={};PF_ADD_POINT("Pivot",50,50,FALSE,Pivot);
    PF_ADD_FLOAT_SLIDERX("Mix",0,100,0,100,100,1,PF_ValueDisplayFlag_PERCENT,0,Mix);
    out_data->num_params=Count;return PF_Err_NONE;
}
PF_Err preRender(PF_InData* in,PF_OutData* out,PF_PreRenderExtra* extra) {
    if(extra->input->bitdepth!=8&&extra->input->bitdepth!=16) fail(out,"Use an 8 or 16 bpc project. 32 bpc is not supported.");
    if(in->time_step<=0||!in->time_scale) fail(out,"Positive frame time is required. Precompose reversed or remapped footage first.");
    // Reject time-remapping on the effect layer; remap INSIDE the source precomp.
    {
        Suite<AEGP_PFInterfaceSuite1> pf(in,kAEGPPFInterfaceSuite,kAEGPPFInterfaceSuiteVersion1);
        Suite<AEGP_LayerSuite9> layer(in,kAEGPLayerSuite,kAEGPLayerSuiteVersion9);
        AEGP_LayerH h=nullptr;AEGP_LayerFlags flags=0;
        require(pf->AEGP_GetEffectLayer(in->effect_ref,&h));require(layer->AEGP_GetLayerFlags(h,&flags));
        if(flags&AEGP_LayerFlag_TIME_REMAPPING) fail(out,"Precompose time-remapped footage, then apply DreamBack to the new precomp layer.");
    }
    auto p=std::make_unique<Plan>();
    const double dsx=double(in->downsample_x.num)/in->downsample_x.den;
    const double dsy=double(in->downsample_y.num)/in->downsample_y.den;
    if(!(dsx>0&&dsy>0&&in->pixel_aspect_ratio.den>0)) fail(out,"Invalid preview geometry.");
    p->w=int(std::ceil(in->width*dsx));p->h=int(std::ceil(in->height*dsy));
    if(p->w<=0||p->h<=0||std::size_t(p->w)>11'000'000/std::size_t(p->h)) fail(out,"Frame is too large. Use a reduced-resolution preview (maximum 11 million pixels).");
    p->geometry.pixelAspect=double(in->pixel_aspect_ratio.num)/in->pixel_aspect_ratio.den*dsy/dsx;
    const int delay=std::clamp(integer(in,Delay,in->current_time),1,120);
    p->depth=std::clamp(integer(in,Depth,in->current_time),1,32);
    p->mix=std::clamp(scalar(in,Mix,in->current_time)/100,0.0,1.0);
    if(p->mix==0) p->depth=0;
    PF_RenderRequest req=extra->input->output_request;
    req.rect={0,0,p->w,p->h};req.channel_mask=PF_ChannelMask_ARGB;
    // Keep the host request's zero-alpha RGB preservation setting.
    for(int s=0;s<=p->depth;++s) {
        require(PF_ABORT(in));
        auto& stage=p->stages[s];stage.id=s+1;
        const auto time=std::int64_t(in->current_time)-std::int64_t(s)*delay*in->time_step;
        if(time<std::numeric_limits<A_long>::min()||time>std::numeric_limits<A_long>::max()) fail(out,"History time exceeds SDK time range.");
        stage.time=A_long(time);stage.valid=time>=0;
        if(stage.valid) stage.c=controls(in,stage.time);
        if(stage.valid||s==0) {
            // Declare current input even at negative time, so output checkout
            // always follows an input checkout. Its pixels are ignored there.
            PF_CheckoutResult result{};
            require(extra->cb->checkout_layer(in->effect_ref,Input,stage.id,&req,stage.time,in->time_step,in->time_scale,&result));
        }
    }
    // Fixed output domain is the original layer. Upstream expanded bounds are
    // deliberately clipped; never invent a huge max_result_rect.
    extra->output->max_result_rect=req.rect;
    extra->output->result_rect={std::max(A_long(0),extra->input->output_request.rect.left),
        std::max(A_long(0),extra->input->output_request.rect.top),
        std::min(A_long(p->w),extra->input->output_request.rect.right),
        std::min(A_long(p->h),extra->input->output_request.rect.bottom)};
    if(extra->output->result_rect.right<=extra->output->result_rect.left||extra->output->result_rect.bottom<=extra->output->result_rect.top)
        extra->output->result_rect={0,0,0,0};
    extra->output->solid=FALSE;
    extra->output->delete_pre_render_data_func=deletePlan;
    extra->output->pre_render_data=p.release();
    return PF_Err_NONE;
}
class InputPixels {
    PF_InData* in;PF_SmartRenderExtra* extra;int id;bool live=false;
public:
    PF_EffectWorld* world=nullptr;
    InputPixels(PF_InData* i,PF_SmartRenderExtra* e,int n):in(i),extra(e),id(n) {
        require(extra->cb->checkout_layer_pixels(in->effect_ref,id,&world));live=true;
    }
    ~InputPixels() { if(live) extra->cb->checkin_layer_pixels(in->effect_ref,id); }
    void close() { live=false;require(extra->cb->checkin_layer_pixels(in->effect_ref,id)); }
};
PF_PixelFormat format(const PF_EffectWorld* w,const PF_WorldSuite2* suite) {
    PF_PixelFormat f=PF_PixelFormat_INVALID;require(suite->PF_GetPixelFormat(w,&f));
    if(f!=PF_PixelFormat_ARGB32&&f!=PF_PixelFormat_ARGB64) throw PF_Err(PF_Err_UNRECOGNIZED_PARAM_TYPE);
    return f;
}
template<class P> void read(const PF_EffectWorld* w,Image& image,float max,PF_InData* in) {
    if(!w||!w->data) return; // absent source is transparent black
    for(int y=0;y<w->height;++y) {
        if(y%32==0) require(PF_ABORT(in));
        const int iy=y+w->origin_y;if(iy<0||iy>=image.height) continue;
        const auto* row=reinterpret_cast<const P*>(reinterpret_cast<const char*>(w->data)+std::ptrdiff_t(y)*w->rowbytes);
        for(int x=0;x<w->width;++x) {
            const int ix=x+w->origin_x;if(ix<0||ix>=image.width) continue;
            const P a=row[x];image.at(ix,iy)={a.red/max,a.green/max,a.blue/max,a.alpha/max};
        }
    }
}
template<class P> void write(const Image& image,PF_EffectWorld* w,double max,PF_InData* in) {
    auto channel=[max](float f){return std::lround(std::clamp(double(f),0.0,1.0)*max);};
    for(int y=0;y<w->height;++y) {
        if(y%32==0) require(PF_ABORT(in));
        auto* row=reinterpret_cast<P*>(reinterpret_cast<char*>(w->data)+std::ptrdiff_t(y)*w->rowbytes);
        for(int x=0;x<w->width;++x) {
            const int ix=x+w->origin_x,iy=y+w->origin_y;
            Pixel p;if(ix>=0&&iy>=0&&ix<image.width&&iy<image.height)p=image.at(ix,iy);
            row[x]={};row[x].alpha=channel(p.a);row[x].red=channel(p.r);row[x].green=channel(p.g);row[x].blue=channel(p.b);
        }
    }
}
PF_Err smartRender(PF_InData* in,PF_SmartRenderExtra* extra) {
    const auto* p=static_cast<const Plan*>(extra->input->pre_render_data);
    if(!p) return PF_Err_INTERNAL_STRUCT_DAMAGED;
    if(extra->input->bitdepth!=8&&extra->input->bitdepth!=16) return PF_Err_UNRECOGNIZED_PARAM_TYPE;
    Suite<PF_WorldSuite2> worlds(in,kPFWorldSuite,kPFWorldSuiteVersion2);
    PF_EffectWorld* output=nullptr;
    auto image=reconstruct(p->w,p->h,p->depth,p->mix,p->geometry,[&](int s,Image& source) {
        require(PF_PROGRESS(in,p->depth-s,p->depth+1));
        std::fill(source.pixels.begin(),source.pixels.end(),Pixel{});
        const auto& stage=p->stages[s];
        if(stage.valid||s==0) {
            InputPixels pixels(in,extra,stage.id);
            // Output checkout follows the first input checkout, as SmartFX requires.
            if(!output) require(extra->cb->checkout_output(in->effect_ref,&output));
            if(stage.valid&&pixels.world&&pixels.world->data) {
                auto f=format(pixels.world,worlds.ptr);
                if(f==PF_PixelFormat_ARGB32) read<PF_Pixel>(pixels.world,source,255,in);
                else read<PF_Pixel16>(pixels.world,source,32768,in);
            }
            pixels.close();
        }
        return stage.c;
    },[&]{require(PF_ABORT(in));return false;});
    if(!output) return PF_Err_INTERNAL_STRUCT_DAMAGED;
    if(!output||!output->data) return PF_Err_NONE;
    auto f=format(output,worlds.ptr);
    if(f==PF_PixelFormat_ARGB32) write<PF_Pixel>(image,output,255,in);
    else write<PF_Pixel16>(image,output,32768,in);
    require(PF_PROGRESS(in,p->depth+1,p->depth+1));
    return PF_Err_NONE;
}
}
extern "C" DllExport PF_Err PluginDataEntryFunction2(PF_PluginDataPtr p,PF_PluginDataCB2 cb,SPBasicSuite*,const char*,const char*) {
    PF_Err result=PF_Err_NONE;
    PF_REGISTER_EFFECT_EXT2(p,cb,"DreamBack",DREAMBACK_MATCH,"DreamBack",AE_RESERVED_INFO,"EffectMain","https://github.com/FloppingTacos/DreamBack");
    return result;
}
extern "C" DllExport PF_Err EffectMain(PF_Cmd cmd,PF_InData* in,PF_OutData* out,PF_ParamDef*[],PF_LayerDef*,void* extra) {
    try {
        switch(cmd) {
            case PF_Cmd_ABOUT: std::snprintf(out->return_msg,sizeof(out->return_msg),"DreamBack 0.1\rFinite delayed camera feedback. Screen and Overlay; 8/16 bpc.");break;
            case PF_Cmd_GLOBAL_SETUP: out->my_version=PF_VERSION(0,1,0,PF_Stage_DEVELOP,1);out->out_flags=DREAMBACK_FLAGS;out->out_flags2=DREAMBACK_FLAGS2;break;
            case PF_Cmd_PARAMS_SETUP:return params(in,out);
            case PF_Cmd_SMART_PRE_RENDER:return preRender(in,out,static_cast<PF_PreRenderExtra*>(extra));
            case PF_Cmd_SMART_RENDER:return smartRender(in,static_cast<PF_SmartRenderExtra*>(extra));
            case PF_Cmd_RENDER:fail(out,"This prototype requires After Effects SmartFX.");
            default:break;
        }
    } catch(PF_Err e) { return e; }
      catch(const dreamback::Cancelled&) { return PF_Interrupt_CANCEL; }
      catch(const std::bad_alloc&) { return PF_Err_OUT_OF_MEMORY; }
      catch(const std::length_error&) { return PF_Err_OUT_OF_MEMORY; }
      catch(const std::exception& e) {std::snprintf(out->return_msg,sizeof(out->return_msg),"DreamBack: %s",e.what());out->out_flags|=PF_OutFlag_DISPLAY_ERROR_MESSAGE;return PF_Err_INTERNAL_STRUCT_DAMAGED;}
      catch(...) {return PF_Err_INTERNAL_STRUCT_DAMAGED;}
    return PF_Err_NONE;
}
