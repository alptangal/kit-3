<script lang="ts">
	import type { BasicConfigs } from "$components/interface";
	import { styleSynced } from "$modules";
	import { handleEvents } from "$modules/_attachments";
	import { getNavigationMainCtx } from "..";
	import type { NavigationMainLeft } from "../_inteface";


    let {children,...props}:NavigationMainLeft=$props()
    const navivationMainCtx=getNavigationMainCtx();
    let configs:BasicConfigs=$state({
      ref:undefined as undefined|HTMLElement,
      get style(){
        return styleSynced({})
      },
      event:{
        load:{
        handler(){
          if(navivationMainCtx.addNode && configs.ref){
            navivationMainCtx.addNode({ref:configs.ref,position:'left'})
          }
        },
        options:{
          delay:3000
        }
      }},
      childrens:undefined as undefined|HTMLElement[]
    })
</script>
<svelte:element this={props.as??'div'} bind:this={configs.ref} class={configs.style} {@attach handleEvents([{events:[configs.event??{}]}])}>
    {@render children?.()}
</svelte:element>
