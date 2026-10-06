#include "AEConfig.h"
#include "AE_EffectVers.h"
#include "Metadata.h"
#include "AE_General.r"
resource 'PiPL' (16000) {
    {
        Kind { AEEffect },
        Name { "DreamBack" },
        Category { "DreamBack" },
        CodeMacIntel64 { "EffectMain" },
        CodeMacARM64 { "EffectMain" },
        AE_PiPL_Version { 2, 0 },
        AE_Effect_Spec_Version { PF_PLUG_IN_VERSION, PF_PLUG_IN_SUBVERS },
        AE_Effect_Version { DREAMBACK_VERSION },
        AE_Effect_Info_Flags { 0 },
        AE_Effect_Global_OutFlags { DREAMBACK_FLAGS },
        AE_Effect_Global_OutFlags_2 { DREAMBACK_FLAGS2 },
        AE_Effect_Match_Name { DREAMBACK_MATCH },
        AE_Reserved_Info { 8 },
        AE_Effect_Support_URL { "https://github.com/FloppingTacos/DreamBack" }
    }
};
