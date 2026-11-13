import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as LibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import {
  demoCoordinates,
  demoRoadRoute,
  demoCarpoolRouteIndices,
  officeCoordinate,
} from "./carpool-demo-data";
import styles from "./CarpoolDemo.module.css";
import { shuttleStopLocations } from "./shuttle-stop-data";
const shuttleCoordinates = shuttleStopLocations.map((stop) => stop.coordinate);
maplibregl.setWorkerUrl(workerUrl);
export default function CarpoolDemoMap({
  pickup,
  destination,
  shuttle = false,
  onStop,
}: {
  pickup: number;
  destination: number;
  shuttle?: boolean;
  onStop?: (index: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const onStopRef = useRef(onStop);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);
  useEffect(() => {
    let instance: LibreMap;
    let resize: ResizeObserver | undefined;
    try {
      instance = new maplibregl.Map({
        container: container.current!,
        center: shuttle ? shuttleCoordinates[0] : officeCoordinate,
        zoom: 15,
        attributionControl: { compact: false },
        style: "https://tiles.openfreemap.org/styles/positron",
      });
      map.current = instance;
      instance.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-left",
      );
      instance.on("error", () => setFailed(true));
      instance.on("load", () => setFailed(false));
      resize = new ResizeObserver(() => instance.resize());
      resize.observe(container.current!);
      return () => {
        resize?.disconnect();
        markers.current.forEach((marker) => marker.remove());
        instance.remove();
        map.current = null;
      };
    } catch {
      queueMicrotask(() => setFailed(true));
    }
  }, [shuttle]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const update = () => {
      const points = shuttle ? shuttleCoordinates : demoCoordinates;
      const from = points[pickup],
        to = points[destination];
      const data = {
        type: "FeatureCollection" as const,
        features:
          !shuttle && from && to
            ? [
                {
                  type: "Feature" as const,
                  properties: {},
                  geometry: {
                    type: "LineString" as const,
                    coordinates: demoRoadRoute.slice(
                      demoCarpoolRouteIndices[Math.min(pickup, destination)],
                      demoCarpoolRouteIndices[Math.max(pickup, destination)] +
                        1,
                    ),
                  },
                },
              ]
            : [],
      };
      const source = instance.getSource("demo-route") as
        maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else {
        instance.addSource("demo-route", { type: "geojson", data });
        instance.addLayer({
          id: "demo-route",
          type: "line",
          source: "demo-route",
          paint: {
            "line-color": "#8b002b",
            "line-width": 4,
            "line-dasharray": shuttle ? [1, 0] : [2, 2],
          },
        });
      }
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      if (!shuttle) {
        const office = document.createElement("div");
        office.className = styles.officePin;
        office.textContent = "Sales office - approximate";
        markers.current.push(
          new maplibregl.Marker({ element: office })
            .setLngLat(officeCoordinate)
            .addTo(instance),
        );
      }
      const indices = shuttle
        ? points.map((_, index) => index)
        : [pickup, destination];
      indices.forEach((index) => {
        const element = document.createElement(shuttle ? "button" : "div");
        element.className = styles.pin;
        if (element instanceof HTMLButtonElement) {
          element.type = "button";
          element.setAttribute(
            "aria-label",
            `Select ${shuttleStopLocations[index].label}`,
          );
          element.setAttribute(
            "aria-pressed",
            String(index === pickup || index === destination),
          );
          element.title = shuttleStopLocations[index].label;
          element.onclick = () => onStopRef.current?.(index);
        }
        element.textContent = shuttle
          ? String(index + 1)
          : index === pickup
            ? "A"
            : "B";
        if (index === pickup || index === destination)
          element.classList.add(styles.selectedPin);
        markers.current.push(
          new maplibregl.Marker({ element })
            .setLngLat(points[index])
            .addTo(instance),
        );
      });
      const anchor = shuttle ? shuttleCoordinates[0] : officeCoordinate;
      const bounds = new maplibregl.LngLatBounds(anchor, anchor);
      (shuttle
        ? points
        : demoRoadRoute.slice(
            demoCarpoolRouteIndices[Math.min(pickup, destination)],
            demoCarpoolRouteIndices[Math.max(pickup, destination)] + 1,
          )
      )
        .filter(Boolean)
        .forEach((point) => bounds.extend(point));
      instance.fitBounds(bounds, { padding: 55, maxZoom: 15.5, duration: 0 });
    };
    if (instance.isStyleLoaded()) update();
    else instance.once("load", update);
    return () => {
      instance.off("load", update);
    };
  }, [pickup, destination, shuttle]);
  return (
    <>
      <div
        ref={container}
        className={styles.map}
        role="region"
        aria-label={
          shuttle
            ? "Seven shuttle stops supplied by the association"
            : "Carpool demo map around the approximate sales office pin"
        }
      />
      {failed && (
        <div className={styles.mapError} role="status">
          Map tiles could not load. Use the location selectors below; retry with
          Reset map.
        </div>
      )}
    </>
  );
}
