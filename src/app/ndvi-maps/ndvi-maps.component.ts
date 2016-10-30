/*!
 * NDVI Maps Component
 *
 * Copyright(c) Exequiel Ceasar Navarrete <esnavarrete1@up.edu.ph>
 * Licensed under MIT
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { Http, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { Store } from '@ngrx/store';
import { LeafletMapService } from '../leaflet-map.service';
import { LayerState, Layer } from '../store';
import { Map, TileLayer } from 'leaflet';
import { isNaN } from 'lodash';
import 'rxjs/add/operator/debounceTime';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-ndvi-maps',
  templateUrl: './ndvi-maps.component.html',
  styleUrls: ['./ndvi-maps.component.sass']
})
export class NdviMapsComponent implements OnInit, OnDestroy {
  private _ndviLayer: TileLayer;
  private _mapLayers: Observable<LayerState>;

  constructor(
    private _mapService: LeafletMapService,
    private _http: Http,
    private _route: ActivatedRoute,
    private _router: Router,
    private _mapLayersStore: Store<any>
  ) { }

  ngOnInit() {
    // listen for changes in crop url parameter since `route.params` is an instance of Observable!
    this._route.params.forEach((params: Params) => {
      let converted = parseInt(params['scanRange'], 10);
      // check if startDate and scanRange is valid
      if (
        typeof params['startDate'] !== 'undefined' &&
        typeof params['scanRange'] !== 'undefined' &&
        /^\d{4}[\/\-](0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])/g.test(params['startDate']) &&
        !isNaN(converted)
      ) {
        this.processData(params['startDate'], parseInt(params['scanRange'], 10));
      }
    });
  }

  processData(startDate: string, scanRange: number) {
    let getMapToken =  this._http
      .get(`http://127.0.0.1:5000/ndvi/?date=${startDate}&range=${scanRange}`)
      .map((res: Response) => res.json())
      ;

    // remove all layers published on the store
    this._mapLayersStore.dispatch({
      type: 'REMOVE_ALL_LAYERS'
    });

    // combine the observable and the promise into one
    // and process the data when token is available.
    Observable.combineLatest(getMapToken, this._mapService.getMap())
      .debounceTime(300)
      .subscribe((params: [any, Map]) => {
        let response = params[0];
        let map = params[1];

        let tileUrl = `https://earthengine.googleapis.com/map/${response.mapId}/{z}/{x}/{y}?token=${response.mapToken}`;

        let payload: Layer = {
          id: 'ndvi-layer-1',
          url: tileUrl,
          type: 'ndvi',
          data: {
            wmsOptions: {
              attribution: 'Layer data &copy; <a href="https://earthengine.google.com/" target="_blank">Google Earth Engine</a>',
              zIndex: 1000,
              opacity: 0.6
            }
          }
        };

        // assemble the tile layer
        this._ndviLayer = L.tileLayer(payload.url, payload.data.wmsOptions);

        // add the new layer to the store
        this._mapLayersStore.dispatch({
          type: 'ADD_LAYER',
          payload: payload
        });

        // add the layer to the map
        this._ndviLayer.addTo(map);
      })
      ;
  }

  ngOnDestroy() {
    // remove all layers published on the store
    this._mapLayersStore.dispatch({
      type: 'REMOVE_ALL_LAYERS'
    });

    this._mapService.getMap().then((map: Map) => {
      // remove the layer from the map
      this._ndviLayer.removeFrom(map);
    });
  }

}


