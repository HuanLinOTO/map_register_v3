import type { Ref } from 'vue'
import type { LeafletEvent, LeafletEventHandlerFnMap } from 'leaflet'
import { GenshinMap } from '../utils'
import type { MapTileConfig } from '../configs'
import type { AnyArray, AnyFunction } from '@/shared'
import { useMapStore } from '@/stores'

export interface BaseLayerChangeEvent extends L.LayersControlEvent {
  layerConfig?: MapTileConfig
}

const map = ref<GenshinMap | null>(null) as Ref<GenshinMap | null>
const stopPropagationSignal = ref(false)

export const useMap = (ele?: Ref<HTMLElement | null>) => {
  const mapStore = useMapStore()

  const preloadListeners = shallowRef<[string, AnyFunction][]>([])
  const scopedListeners = shallowRef<[string, AnyFunction][]>([])

  const callWithSignal = (fn: AnyFunction<void>, ...args: AnyArray) => {
    if (stopPropagationSignal.value) {
      stopPropagationSignal.value = false
      return
    }
    fn(...args)
  }

  const on = <T extends keyof LeafletEventHandlerFnMap>(type: T, fn: LeafletEventHandlerFnMap[T]) => {
    if (!fn)
      return
    scopedListeners.value.push([type, fn])
    if (!map.value) {
      preloadListeners.value.push([type, (...args) => callWithSignal(fn, ...args)])
      return
    }
    map.value.addEventListener(type, (...args) => callWithSignal(fn, ...args))
  }

  const hasEventListeners = (type: string) => {
    if (!map.value)
      return preloadListeners.value.find(([name]) => name === type) !== undefined
    return map.value.hasEventListeners(type)
  }

  // 考虑到该 hook 可能被重用，需使以下监听器只会被附加一次

  on('zoom', (ev) => {
    if (hasEventListeners('zoom'))
      return
    mapStore.zoom = (ev.target as GenshinMap).getZoom()
  })

  on('move', useDebounceFn((ev: LeafletEvent) => {
    if (hasEventListeners('move'))
      return
    const center = (ev.target as GenshinMap).getCenter()
    mapStore.center = [Math.floor(center.lat), Math.floor(center.lng)]
  }, 500))

  on('baselayerchange', (ev: BaseLayerChangeEvent) => {
    if (hasEventListeners('move'))
      return
    if (!mapStore.center) {
      mapStore.center = ev.layerConfig?.settings?.center as [number, number]
      mapStore.zoom = ev.layerConfig?.settings?.zoom as number
      return
    }
    map.value?.flyTo(mapStore.center, mapStore.zoom ?? 0, {
      duration: 0.1,
    })
  })

  onMounted(() => {
    if (!ele?.value)
      return
    if (!map.value) {
      const newMap = new GenshinMap(ele.value, {
        center: [-5948, 2176],
        zoom: -3,
        maxZoom: 2,
        minZoom: -4,
        tap: false,
        zoomAnimation: true,
        fadeAnimation: true,
        attributionControl: false,
        zoomControl: false,
        preferCanvas: true,
      })
      map.value = newMap
    }
    preloadListeners.value.forEach(([type, fn]) => map.value?.addEventListener(type, (...args) => callWithSignal(fn, ...args)))
  })

  onBeforeUnmount(() => {
    if (ele) {
      map.value?.remove()
      map.value = null
    }
    scopedListeners.value.forEach(([type, fn]) => {
      map.value?.removeEventListener(type, fn)
    })
  })

  return { map, stopPropagationSignal, on }
}
