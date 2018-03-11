#version 130

uniform sampler2D tex_input;
uniform int size;
uniform int n_total;
uniform int n_step;

in vec3 normal;
uniform vec3 iResolution;
out vec4 outColor;

void main()                                      
{      
    vec2 tex_coord = gl_FragCoord.xy/iResolution.xy;
        float cur_x = gl_FragCoord.x - 0.5;
    float cur_y = gl_FragCoord.y - 0.5;
    
    vec4 outv;
    int tex_coord_n = int((cur_y*size)+cur_x);
    
    //updata weight
    vec2 pre_w = texture(tex_input,tex_coord).rg;
    float i = pre_w.r;
    float n = pre_w.g;
    float new_i;
    float new_n;
    new_i = i;
    new_n = n*2;
    if(tex_coord_n%(n_step*4) > n_step*2-1)
    {
        new_i += n_step*2;
    }
    outv.r = new_i;
    outv.g = new_n;
    
    //updata index
    vec2 pre_index = texture(tex_input,tex_coord).ba;
    int x = int(pre_index.x);
    int y = int(pre_index.y);
    int ni = n_step*2;
    int new_tex_coord_n = tex_coord_n;
    if((tex_coord_n/ni)%2==0)
    {
        new_tex_coord_n += ni;
    }
    else
    {
        new_tex_coord_n -= ni;
    }
    outv.b = new_tex_coord_n%size;
    outv.a = new_tex_coord_n/size;
    
    outColor = outv;
}