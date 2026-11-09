#include <stdint.h>
#include <string.h>
typedef struct {int16_t addinfo,max_axis;char cnc[2],mt[2],series[4],version[4],axes[2];} Info;
typedef struct {int16_t hdck,tmmode,aut,run,motion,mstb,emergency,alarm,edit;} Status;
static int opened,freed,calls,mode;
void fixture_reset(int value){opened=freed=calls=0;mode=value;}
int fixture_opened(void){return opened;} int fixture_freed(void){return freed;} int fixture_calls(void){return calls;}
int16_t cnc_allclibhndl3(const char *ip,uint16_t port,int32_t timeout,uint16_t *h){(void)ip;if(port!=8193||timeout!=3)return -99;*h=11;opened++;return 0;}
int16_t cnc_freelibhndl(uint16_t h){if(h!=11)return -99;freed++;return 0;}
int16_t cnc_sysinfo(uint16_t h,Info *p){(void)h;memset(p,0,sizeof(*p));p->addinfo=1538;p->max_axis=3;memcpy(p->cnc,mode==5?"16":" 0",2);memcpy(p->mt," M",2);memcpy(p->axes," 3",2);return mode==4?-8:0;}
int16_t cnc_statinfo(uint16_t h,Status *p){(void)h;memset(p,0,sizeof(*p));p->aut=1;p->run=3;return 0;}
int16_t cnc_rddiaginfo(uint16_t h,int16_t number,uint16_t count,uint8_t *p){(void)h;if(count!=1)return -99;calls++;int16_t values[]={1,0,0,number,(int16_t)(128|4|2)};if(mode==2)values[3]++;memcpy(p,values,10);return 0;}
int16_t cnc_diagnoss(uint16_t h,int16_t number,int16_t axis,int16_t length,uint8_t *p){(void)h;if(length!=6||axis!=1)return -99;calls++;int16_t values[]={number,axis,-1234};memcpy(p,values,6);return 0;}
int16_t pmc_rdpmcrng(uint16_t h,int16_t area,int16_t type,uint16_t start,uint16_t end,uint16_t length,uint8_t *p){(void)h;calls++;if(type!=0||start!=end||length!=9)return -99;if(mode==3)return 3;uint16_t values[]={(uint16_t)area,0,start,end};memcpy(p,values,8);p[8]=0x42;return 0;}
