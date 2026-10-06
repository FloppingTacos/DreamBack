#include "../src/ae/DreamBack.cpp"
#include <cassert>
#include <iostream>
#include <map>
#include <set>
#include <vector>
struct Host {
    PF_ParamDef defs[Count]{};int added=1,parameterLive=0,suites=0,pixelLive=0,abortCalls=0,cancelAt=-1;
    bool remap=false,invalidFormat=false;int failCheckout=-1;double dsx=1,dsy=1;
    PF_InData in{};PF_OutData out{};PF_EffectWorld output{};
    std::vector<unsigned char> outputBytes;
    struct World { PF_EffectWorld world{}; std::vector<unsigned char> bytes; };
    std::map<int,A_long> times;std::map<int,World> worlds;std::set<int> used;
    PF_WorldSuite2 worldSuite{};AEGP_PFInterfaceSuite1 pfSuite{};AEGP_LayerSuite9 layerSuite{};SPBasicSuite basic{};
};
static Host* host;
static PF_Err addParam(PF_ProgPtr,A_long,PF_ParamDef* p) {host->defs[host->added++]=*p;return 0;}
static PF_Err checkParam(PF_ProgPtr,PF_ParamIndex index,A_long t,A_long step,A_u_long scale,PF_ParamDef* out) {
    assert(step==host->in.time_step&&scale==host->in.time_scale);
    *out=host->defs[index];++host->parameterLive;
    if(index==Position) {out->u.td.x_value=A_Fixed(std::sin(t*.1)*2*host->dsx*65536);out->u.td.y_value=0;}
    if(index==Pivot) {out->u.td.x_value=A_Fixed(host->in.width*host->dsx*.5*65536);out->u.td.y_value=A_Fixed(host->in.height*host->dsy*.5*65536);}
    if(index==Rotation) out->u.ad.value=A_Fixed((t>=6&&t<=9?15:0)*65536);
    return 0;
}
static PF_Err checkinParam(PF_ProgPtr,PF_ParamDef*) {--host->parameterLive;return 0;}
static PF_Err abortRender(PF_ProgPtr) {return host->cancelAt>=0&&host->abortCalls++>=host->cancelAt?PF_Interrupt_CANCEL:0;}
static PF_Err progress(PF_ProgPtr,A_long,A_long) {return 0;}
static A_Err effectLayer(PF_ProgPtr,AEGP_LayerH* h) {*h=reinterpret_cast<AEGP_LayerH>(host);return 0;}
static A_Err layerFlags(AEGP_LayerH,AEGP_LayerFlags* flags) {*flags=host->remap?AEGP_LayerFlag_TIME_REMAPPING:0;return 0;}
static PF_Err pixelFormat(const PF_EffectWorld* w,PF_PixelFormat* f) {*f=host->invalidFormat?PF_PixelFormat_ARGB128:((w->world_flags&PF_WorldFlag_DEEP)?PF_PixelFormat_ARGB64:PF_PixelFormat_ARGB32);return 0;}
static SPErr acquire(const char* name,int32 version,const void** suite) {
    if(!std::strcmp(name,kPFWorldSuite)&&version==2)*suite=&host->worldSuite;
    else if(!std::strcmp(name,kAEGPPFInterfaceSuite)&&version==1)*suite=&host->pfSuite;
    else if(!std::strcmp(name,kAEGPLayerSuite)&&version==kAEGPLayerSuiteVersion9)*suite=&host->layerSuite;
    else return PF_Err_INVALID_CALLBACK;
    ++host->suites;return 0;
}
static SPErr release(const char*,int32) {--host->suites;return 0;}
static PF_Err checkoutLayer(PF_ProgPtr,PF_ParamIndex index,A_long id,const PF_RenderRequest* req,A_long t,A_long step,A_u_long scale,PF_CheckoutResult* result) {
    assert(index==0&&id>0&&!host->times.count(id)&&(t>=0||id==1)&&step==host->in.time_step&&scale==host->in.time_scale);
    assert(req->channel_mask==PF_ChannelMask_ARGB&&req->rect.left==0&&req->rect.top==0);
    assert(req->rect.right==std::ceil(host->in.width*host->dsx)&&req->rect.bottom==std::ceil(host->in.height*host->dsy));
    if(id==host->failCheckout)return PF_Err_INVALID_CALLBACK;
    host->times[id]=t;result->result_rect=result->max_result_rect=req->rect;return 0;
}
static PF_Err pixels(PF_ProgPtr,A_long id,PF_EffectWorld** output) {
    assert(host->times.count(id)&&!host->used.count(id));host->used.insert(id);
    auto& owned=host->worlds[id];auto& w=owned.world;
    w.width=int(std::ceil(host->in.width*host->dsx));w.height=int(std::ceil(host->in.height*host->dsy));
    w.world_flags=host->output.world_flags;const bool deep=w.world_flags&PF_WorldFlag_DEEP;
    w.rowbytes=w.width*(deep?8:4)+32;owned.bytes.resize(w.rowbytes*w.height,0xCD);
    w.data=reinterpret_cast<PF_PixelPtr>(owned.bytes.data());
    for(int y=0;y<w.height;++y)for(int x=0;x<w.width;++x) {
        if(deep) {auto* row=reinterpret_cast<PF_Pixel16*>(owned.bytes.data()+y*w.rowbytes);row[x]={32768,A_u_short((x+host->times[id])%w.width*32768/w.width),A_u_short(y*32768/w.height),0};}
        else {auto* row=reinterpret_cast<PF_Pixel*>(owned.bytes.data()+y*w.rowbytes);row[x]={255,A_u_char((x+host->times[id])%w.width*255/w.width),A_u_char(y*255/w.height),0};}
    }
    ++host->pixelLive;*output=&w;return 0;
}
static PF_Err checkinPixels(PF_ProgPtr,A_long) {--host->pixelLive;return 0;}
static PF_Err output(PF_ProgPtr,PF_EffectWorld** w) {assert(host->pixelLive||host->times.empty());*w=&host->output;return 0;}
static void init(Host& h) {
    host=&h;h.in.width=32;h.in.height=24;h.in.current_time=40;h.in.time_step=1;h.in.time_scale=30;h.in.total_time=240;
    h.in.downsample_x={1,1};h.in.downsample_y={1,1};h.in.pixel_aspect_ratio={1,1};
    h.in.inter.add_param=addParam;h.in.inter.checkout_param=checkParam;h.in.inter.checkin_param=checkinParam;h.in.inter.abort=abortRender;h.in.inter.progress=progress;
    h.worldSuite.PF_GetPixelFormat=pixelFormat;h.pfSuite.AEGP_GetEffectLayer=effectLayer;h.layerSuite.AEGP_GetLayerFlags=layerFlags;
    h.basic.AcquireSuite=acquire;h.basic.ReleaseSuite=release;h.in.pica_basicP=&h.basic;
    assert(EffectMain(PF_Cmd_PARAMS_SETUP,&h.in,&h.out,nullptr,nullptr,nullptr)==0);
    assert(h.added==Count&&h.out.num_params==Count);
    assert(h.defs[Delay].flags&PF_ParamFlag_CANNOT_TIME_VARY);assert(h.defs[Depth].flags&PF_ParamFlag_CANNOT_TIME_VARY);
    for(int i=Feedback;i<Count;++i)assert(!(h.defs[i].flags&PF_ParamFlag_CANNOT_TIME_VARY));
    assert(EffectMain(PF_Cmd_GLOBAL_SETUP,&h.in,&h.out,nullptr,nullptr,nullptr)==0);
    assert(h.out.my_version==DREAMBACK_VERSION&&h.out.out_flags==DREAMBACK_FLAGS&&h.out.out_flags2==DREAMBACK_FLAGS2);
    assert(!(h.out.out_flags2&PF_OutFlag2_SUPPORTS_THREADED_RENDERING));
}
static PF_Err render(Host& h,int t,int depth=8,PF_LRect crop={0,0,32,24}) {
    host=&h;h.in.current_time=t;h.times.clear();h.used.clear();h.worlds.clear();h.abortCalls=0;
    h.output.width=crop.right-crop.left;h.output.height=crop.bottom-crop.top;h.output.origin_x=crop.left;h.output.origin_y=crop.top;
    h.output.rowbytes=h.output.width*(depth==16?8:4)+32;h.output.world_flags=depth==16?PF_WorldFlag_DEEP:0;
    h.outputBytes.assign(h.output.rowbytes*h.output.height,0xCD);h.output.data=reinterpret_cast<PF_PixelPtr>(h.outputBytes.data());
    PF_PreRenderInput input{};input.bitdepth=depth;input.output_request.rect=crop;input.output_request.channel_mask=PF_ChannelMask_ARGB;
    PF_PreRenderOutput preOutput{};PF_PreRenderCallbacks callbacks{};callbacks.checkout_layer=checkoutLayer;
    PF_PreRenderExtra pre{&input,&preOutput,&callbacks};
    auto err=EffectMain(PF_Cmd_SMART_PRE_RENDER,&h.in,&h.out,nullptr,nullptr,&pre);
    if(!err) {
        PF_SmartRenderInput sin{};sin.bitdepth=depth;sin.output_request=input.output_request;sin.pre_render_data=preOutput.pre_render_data;
        PF_SmartRenderCallbacks scb{};scb.checkout_layer_pixels=pixels;scb.checkin_layer_pixels=checkinPixels;scb.checkout_output=output;
        PF_SmartRenderExtra smart{&sin,&scb};err=EffectMain(PF_Cmd_SMART_RENDER,&h.in,&h.out,nullptr,nullptr,&smart);
    }
    if(preOutput.pre_render_data)preOutput.delete_pre_render_data_func(preOutput.pre_render_data);
    assert(h.suites==0&&h.parameterLive==0&&h.pixelLive==0);
    if(!err)for(int y=0;y<h.output.height;++y)for(int i=h.output.width*(depth==16?8:4);i<h.output.rowbytes;++i)assert(h.outputBytes[y*h.output.rowbytes+i]==0xCD);
    return err;
}
int main() {
    Host h;init(h);
    assert(render(h,40)==0);auto first=h.outputBytes;assert(h.times.size()==13);
    assert(h.times[1]==40&&h.times[13]==4);
    assert(render(h,80)==0);assert(render(h,1)==0);assert(render(h,40)==0&&h.outputBytes==first);
    assert(render(h,40,16)==0);auto deep=h.outputBytes;
    for(int y=0;y<24;++y)for(int x=0;x<32;++x) {
        auto a=reinterpret_cast<const PF_Pixel*>(first.data()+y*(32*4+32))[x];
        auto b=reinterpret_cast<const PF_Pixel16*>(deep.data()+y*(32*8+32))[x];
        assert(std::abs(a.red/255.f-b.red/32768.f)<.014f);assert(std::abs(a.alpha/255.f-b.alpha/32768.f)<.014f);
    }
    assert(render(h,40,8,{9,6,21,15})==0);
    for(int y=0;y<9;++y)for(int x=0;x<12;++x) {
        auto* original=first.data()+(y+6)*(32*4+32)+(x+9)*4;
        auto* cropped=h.outputBytes.data()+y*(12*4+32)+x*4;assert(std::memcmp(original,cropped,4)==0);
    }
    assert(render(h,-1)==0);for(int y=0;y<24;++y)for(int x=0;x<32*4;++x)assert(h.outputBytes[y*(32*4+32)+x]==0);
    h.in.downsample_x={1,2};h.in.downsample_y={1,2};h.dsx=h.dsy=.5;assert(render(h,40,8,{0,0,16,12})==0);
    h.in.downsample_x=h.in.downsample_y={1,1};h.dsx=h.dsy=1;
    h.cancelAt=16;assert(render(h,40)==PF_Interrupt_CANCEL);h.cancelAt=-1;
    h.invalidFormat=true;assert(render(h,40)==PF_Err_UNRECOGNIZED_PARAM_TYPE);h.invalidFormat=false;
    h.failCheckout=5;assert(render(h,40)==PF_Err_INVALID_CALLBACK);h.failCheckout=-1;
    h.remap=true;assert(render(h,40)==PF_Err_BAD_CALLBACK_PARAM);h.remap=false;
    h.in.time_step=-1;assert(render(h,40)==PF_Err_BAD_CALLBACK_PARAM);h.in.time_step=1;
    assert(render(h,40,32)==PF_Err_BAD_CALLBACK_PARAM);
    // No render after pre-render: host disposal must suffice.
    PF_PreRenderInput pin{};pin.bitdepth=8;pin.output_request.rect={0,0,32,24};PF_PreRenderOutput pout{};PF_PreRenderCallbacks pcb{};pcb.checkout_layer=checkoutLayer;
    PF_PreRenderExtra pre{&pin,&pout,&pcb};h.times.clear();assert(EffectMain(PF_Cmd_SMART_PRE_RENDER,&h.in,&h.out,nullptr,nullptr,&pre)==0);
    pout.delete_pre_render_data_func(pout.pre_render_data);assert(h.suites==0&&h.parameterLive==0);
    std::cout<<"SDK adapter: registration, metadata, temporal dependencies, formats, row strides, ROI, reduced resolution, order, cancellation, errors and disposal passed\n";
}
