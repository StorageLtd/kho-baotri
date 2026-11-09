/* Isolated Linux test double using Windows 32-bit-long ABI field sizes. No I/O or CNC access. */
#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <time.h>
static struct timespec ready_start;

static int macros_disabled=0,input_precision=4,output_precision=4;
void fixture_precision(int input,int output){input_precision=input;output_precision=output;}
void fixture_disable_macros(int value){macros_disabled=value;}
static int memory_type=2,ends=0,upload_calls=0,requested=0,invalid_column=0;
int fixture_upload_calls(void){return upload_calls;}
void fixture_memory(int v){memory_type=v;invalid_column=0;}
void fixture_bad_column(int v){invalid_column=v;}
int fixture_ends(void){return ends;}
int16_t cnc_rdhdnxt(uint16_t h,int32_t*head,int32_t*next){*head=1;*next=4;return 0;}
int16_t cnc_modal(uint16_t h,int16_t type,int16_t block,void*p){memset(p,0,12);((int16_t*)p)[0]=type;((int32_t*)p)[1]=type==104?1:type==101?4:99;return (type==108||type==104||type==101)&&block==0?0:3;}
int16_t cnc_rdmacro(uint16_t h,int16_t number,int16_t length,void*p){
 if(macros_disabled){return 6;}
 memset(p,0,12);((int16_t*)p)[0]=number;((int16_t*)p)[4]=4;
 int32_t v=0;if(number==4006)v=200000;else if(number==4014)v=540000;else if(number==4111)v=10000;else if(number==4107)v=40000;else if(number==5221)v=-215024;else if(number==5222)v=-122112;else if(number==5223)v=-113900;
 ((int32_t*)p)[1]=v;return length==10?0:2;
}
int16_t cnc_rdaxisname(uint16_t h,int16_t*n,void*p){*n=3;memcpy(p,"X\0Y\0Z\0",6);return 0;}
int16_t cnc_rdtofsinfo(uint16_t h,int16_t*p){p[0]=memory_type;p[1]=32;return 0;}
int16_t cnc_getfigure(uint16_t h,int16_t t,int16_t*valid,int16_t*input,int16_t*output){if(t!=0&&t!=1)return 3;*valid=8;for(int i=0;i<(t==0?3:1);i++){input[i]=input_precision;output[i]=output_precision;}return 0;}
int16_t cnc_rdtofs(uint16_t h,int16_t n,int16_t t,int16_t len,void*p){((int16_t*)p)[0]=n;((int16_t*)p)[1]=t;((int32_t*)p)[1]=n*10000+t;return 0;}
int16_t cnc_rdtofsr(uint16_t h,int16_t start,int16_t t,int16_t end,int16_t len,void*p){
 if(start!=1||end!=32||len!=8+4*32){return 2;}
 memset(p,0,len);((int16_t*)p)[0]=start;((int16_t*)p)[1]=invalid_column?t+1:t;((int16_t*)p)[2]=end;
 for(int i=0;i<32;i++)((int32_t*)p)[2+i]=-10000-i*100-t;
 return 0;
}
int16_t cnc_rdgcode(uint16_t h,int16_t t,int16_t b,int16_t*n,void*p){
 if(t!=-1||b!=1||*n<3){return 3;}
 *n=3;memset(p,0,36);
 const char*codes[]={"G00","G54.1","G90"};for(int i=0;i<3;i++){char*q=(char*)p+i*12;((int16_t*)q)[0]=i+1;memcpy(q+4,codes[i],strlen(codes[i]));}return 0;
}
int16_t cnc_upstart3(uint16_t h,int16_t t,int32_t first,int32_t last){if(t!=0||first!=last)return 3;if(first==7023)return 5;requested=first;upload_calls=0;clock_gettime(CLOCK_MONOTONIC,&ready_start);return 0;}
int16_t cnc_upload3(uint16_t h,int32_t*len,char*p){
 upload_calls++;if(requested==7024){struct timespec now;clock_gettime(CLOCK_MONOTONIC,&now);long elapsed=(now.tv_sec-ready_start.tv_sec)*1000+(now.tv_nsec-ready_start.tv_nsec)/1000000;if(elapsed<120){*len=0;return 10;}const char*text="%\nO07024\nM30\n%\n";int n=strlen(text);if(*len<n)return 2;memcpy(p,text,n);*len=n;return 0;}if(upload_calls==1){*len=0;return 10;}
 if(upload_calls>2){*len=0;return 0;}
 char text[128];snprintf(text,sizeof(text),"%%\nO07020\nN10 G0 X0\nM30\n%%\n");
 if(requested==7022)strcpy(text,"%\nO07022\nN10 G1 X0\n");
 int n=strlen(text);if(*len<n)return 2;memcpy(p,text,n);*len=n;return 0;
}
int16_t cnc_upend3(uint16_t h){ends++;return 0;}

int16_t cnc_rdzofs(uint16_t h,int16_t number,int16_t axis,int16_t length,void*p){
 if(length!=8||number<0||number>6||axis<1||axis>3)return 2;
 ((int16_t*)p)[0]=number;((int16_t*)p)[1]=axis;
 ((int32_t*)p)[1]=number==1?(axis==1?-215024:axis==2?-122112:-113900):0;
 return 0;
}
