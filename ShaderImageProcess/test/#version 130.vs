#version 130
uniform sampler2D tex_index_weight;
uniform sampler2D tex_res_back;
uniform sampler2D test;
uniform int size;
uniform int n_step;

uniform vec3 iResolution;

out vec4 outColor;

void main()                                      
{   
    vec2 tex_coord = gl_FragCoord.xy/iResolution.xy;
    
    float cur_x = gl_FragCoord.x - 0.5;
    float cur_y = gl_FragCoord.y - 0.5;
    
    vec2 outv;
        
    vec4 temp = texture(tex_index_weight,tex_coord);
     vec2 weight = vec2(cos(temp.r/temp.g*2*3.141592653),sin(temp.r/temp.g*2*3.141592653));
     vec2 _param2_index = temp.ba;
    
     vec2 temp_param2_index = _param2_index;
    temp_param2_index.x += 0.5;
    temp_param2_index.y += 0.5;
    vec2 param2_index = temp_param2_index/iResolution.xy;
    
     vec2 param1 = texture(tex_res_back,tex_coord).rg;
     vec2 param2 = texture(tex_res_back,param2_index).rg;
    
    int tex_coord_n1 = int((cur_y*size)+cur_x);
    int tex_coord_n2 = int((_param2_index.y*size)+_param2_index.x);
    
    if(tex_coord_n1<tex_coord_n2)
    {
        outv.r = param1.r + param2.r*weight.r-weight.g*param2.g;
        outv.g = param1.g +weight.r*param2.g + weight.g*param2.r;
    }
    else
    {
        outv.r = param2.r + param1.r*weight.r-weight.g*param1.g;
        outv.g = param2.g +weight.r*param1.g + weight.g*param1.r;
    }
    
    outColor = vec4(outv,0,1);
    
}