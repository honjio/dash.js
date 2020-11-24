'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _Constants=require('./constants/Constants');var _Constants2=_interopRequireDefault(_Constants);var _DashConstants=require('../dash/constants/DashConstants');var _DashConstants2=_interopRequireDefault(_DashConstants);var _StreamProcessor=require('./StreamProcessor');var _StreamProcessor2=_interopRequireDefault(_StreamProcessor);var _FragmentController=require('./controllers/FragmentController');var _FragmentController2=_interopRequireDefault(_FragmentController);var _ThumbnailController=require('./thumbnail/ThumbnailController');var _ThumbnailController2=_interopRequireDefault(_ThumbnailController);var _EventBus=require('../core/EventBus');var _EventBus2=_interopRequireDefault(_EventBus);var _Events=require('../core/events/Events');var _Events2=_interopRequireDefault(_Events);var _Debug=require('../core/Debug');var _Debug2=_interopRequireDefault(_Debug);var _Errors=require('../core/errors/Errors');var _Errors2=_interopRequireDefault(_Errors);var _FactoryMaker=require('../core/FactoryMaker');var _FactoryMaker2=_interopRequireDefault(_FactoryMaker);var _DashJSError=require('./vo/DashJSError');var _DashJSError2=_interopRequireDefault(_DashJSError);var _BoxParser=require('./utils/BoxParser');var _BoxParser2=_interopRequireDefault(_BoxParser);var _URLUtils=require('./utils/URLUtils');var _URLUtils2=_interopRequireDefault(_URLUtils);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function Stream(config){config=config||{};var context=this.context;var eventBus=(0,_EventBus2.default)(context).getInstance();var urlUtils=(0,_URLUtils2.default)(context).getInstance();var manifestModel=config.manifestModel;var mediaPlayerModel=config.mediaPlayerModel;var manifestUpdater=config.manifestUpdater;var adapter=config.adapter;var capabilities=config.capabilities;var errHandler=config.errHandler;var timelineConverter=config.timelineConverter;var dashMetrics=config.dashMetrics;var abrController=config.abrController;var playbackController=config.playbackController;var eventController=config.eventController;var mediaController=config.mediaController;var textController=config.textController;var protectionController=config.protectionController;var videoModel=config.videoModel;var settings=config.settings;var streamInfo=config.streamInfo;var instance=void 0,logger=void 0,streamProcessors=void 0,isStreamInitialized=void 0,isStreamActivated=void 0,isMediaInitialized=void 0,hasVideoTrack=void 0,hasAudioTrack=void 0,updateError=void 0,isUpdating=void 0,fragmentController=void 0,thumbnailController=void 0,preloaded=void 0,boxParser=void 0,preloadingScheduled=void 0,debug=void 0,isEndedEventSignaled=void 0,trackChangedEvent=void 0;var codecCompatibilityTable=[{'codec':'avc1','compatibleCodecs':['avc3']},{'codec':'avc3','compatibleCodecs':['avc1']}];function setup(){debug=(0,_Debug2.default)(context).getInstance();logger=debug.getLogger(instance);resetInitialSettings();boxParser=(0,_BoxParser2.default)(context).getInstance();fragmentController=(0,_FragmentController2.default)(context).create({streamInfo:streamInfo,mediaPlayerModel:mediaPlayerModel,dashMetrics:dashMetrics,errHandler:errHandler,settings:settings,boxParser:boxParser,dashConstants:_DashConstants2.default,urlUtils:urlUtils});}function initialize(){registerEvents();registerProtectionEvents();eventBus.trigger(_Events2.default.STREAM_UPDATED,{streamInfo:streamInfo});}function registerEvents(){eventBus.on(_Events2.default.BUFFERING_COMPLETED,onBufferingCompleted,instance);eventBus.on(_Events2.default.DATA_UPDATE_COMPLETED,onDataUpdateCompleted,instance);eventBus.on(_Events2.default.INBAND_EVENTS,onInbandEvents,instance);}function unRegisterEvents(){eventBus.off(_Events2.default.DATA_UPDATE_COMPLETED,onDataUpdateCompleted,instance);eventBus.off(_Events2.default.BUFFERING_COMPLETED,onBufferingCompleted,instance);eventBus.off(_Events2.default.INBAND_EVENTS,onInbandEvents,instance);}function registerProtectionEvents(){if(protectionController){eventBus.on(_Events2.default.KEY_ERROR,onProtectionError,instance);eventBus.on(_Events2.default.SERVER_CERTIFICATE_UPDATED,onProtectionError,instance);eventBus.on(_Events2.default.LICENSE_REQUEST_COMPLETE,onProtectionError,instance);eventBus.on(_Events2.default.KEY_SYSTEM_SELECTED,onProtectionError,instance);eventBus.on(_Events2.default.KEY_SESSION_CREATED,onProtectionError,instance);eventBus.on(_Events2.default.KEY_STATUSES_CHANGED,onProtectionError,instance);}}function unRegisterProtectionEvents(){if(protectionController){eventBus.off(_Events2.default.KEY_ERROR,onProtectionError,instance);eventBus.off(_Events2.default.SERVER_CERTIFICATE_UPDATED,onProtectionError,instance);eventBus.off(_Events2.default.LICENSE_REQUEST_COMPLETE,onProtectionError,instance);eventBus.off(_Events2.default.KEY_SYSTEM_SELECTED,onProtectionError,instance);eventBus.off(_Events2.default.KEY_SESSION_CREATED,onProtectionError,instance);eventBus.off(_Events2.default.KEY_STATUSES_CHANGED,onProtectionError,instance);}}function getStreamId(){return streamInfo?streamInfo.id:null;}/**
     * Activates Stream by re-initializing some of its components
     * @param {MediaSource} mediaSource
     * @memberof Stream#
     * @param {SourceBuffer} previousBuffers
     */function activate(mediaSource,previousBuffers){if(!isStreamActivated){var result=void 0;eventBus.on(_Events2.default.CURRENT_TRACK_CHANGED,onCurrentTrackChanged,instance);if(!getPreloaded()){result=initializeMedia(mediaSource,previousBuffers);}else{initializeAfterPreload();result=previousBuffers;}isStreamActivated=true;return result;}return previousBuffers;}/**
     * Partially resets some of the Stream elements
     * @memberof Stream#
     * @param {boolean} keepBuffers
     */function deactivate(keepBuffers){var ln=streamProcessors?streamProcessors.length:0;var errored=false;for(var i=0;i<ln;i++){var fragmentModel=streamProcessors[i].getFragmentModel();fragmentModel.removeExecutedRequestsBeforeTime(getStartTime()+getDuration());streamProcessors[i].reset(errored,keepBuffers);}streamProcessors=[];isStreamActivated=false;isMediaInitialized=false;setPreloaded(false);eventBus.off(_Events2.default.CURRENT_TRACK_CHANGED,onCurrentTrackChanged,instance);}function isActive(){return isStreamActivated;}function setMediaSource(mediaSource){for(var i=0;i<streamProcessors.length;){if(isMediaSupported(streamProcessors[i].getMediaInfo())){streamProcessors[i].setMediaSource(mediaSource);i++;}else{streamProcessors[i].reset();streamProcessors.splice(i,1);}}for(var _i=0;_i<streamProcessors.length;_i++){//Adding of new tracks to a stream processor isn't guaranteed by the spec after the METADATA_LOADED state
//so do this after the buffers are created above.
streamProcessors[_i].dischargePreBuffer();}if(streamProcessors.length===0){var msg='No streams to play.';errHandler.error(new _DashJSError2.default(_Errors2.default.MANIFEST_ERROR_ID_NOSTREAMS_CODE,msg+'nostreams',manifestModel.getValue()));logger.fatal(msg);}}function resetInitialSettings(){deactivate();isStreamInitialized=false;hasVideoTrack=false;hasAudioTrack=false;updateError={};isUpdating=false;preloadingScheduled=false;isEndedEventSignaled=false;}function reset(){if(playbackController){playbackController.pause();}if(fragmentController){fragmentController.reset();fragmentController=null;}streamInfo=null;resetInitialSettings();unRegisterEvents();unRegisterProtectionEvents();setPreloaded(false);}function getDuration(){return streamInfo?streamInfo.duration:NaN;}function getIsEndedEventSignaled(){return isEndedEventSignaled;}function setIsEndedEventSignaled(value){isEndedEventSignaled=value;}function getStartTime(){return streamInfo?streamInfo.start:NaN;}function getPreloadingScheduled(){return preloadingScheduled;}function setPreloadingScheduled(value){preloadingScheduled=value;}function getLiveStartTime(){if(!streamInfo.manifestInfo.isDynamic)return NaN;// Get live start time of the video stream (1st in array of streams)
// or audio if no video stream
for(var i=0;i<streamProcessors.length;i++){if(streamProcessors[i].getType()===_Constants2.default.AUDIO||streamProcessors[i].getType()===_Constants2.default.VIDEO){return streamProcessors[i].getLiveStartTime();}}return NaN;}function getId(){return streamInfo?streamInfo.id:null;}function getStreamInfo(){return streamInfo;}function getHasAudioTrack(){return hasAudioTrack;}function getHasVideoTrack(){return hasVideoTrack;}function getThumbnailController(){return thumbnailController;}function checkConfig(){if(!videoModel||!abrController||!abrController.hasOwnProperty('getBitrateList')||!adapter||!adapter.hasOwnProperty('getAllMediaInfoForType')||!adapter.hasOwnProperty('getEventsFor')){throw new Error(_Constants2.default.MISSING_CONFIG_ERROR);}}/**
     * @param {string} type
     * @returns {Array}
     * @memberof Stream#
     */function getBitrateListFor(type){checkConfig();if(type===_Constants2.default.IMAGE){if(!thumbnailController){return[];}return thumbnailController.getBitrateList();}var mediaInfo=getMediaInfo(type);return abrController.getBitrateList(mediaInfo);}function onProtectionError(event){if(event.error){errHandler.error(event.error);logger.fatal(event.error.message);reset();}}function isMediaSupported(mediaInfo){var type=mediaInfo?mediaInfo.type:null;var codec=void 0,msg=void 0;if(type===_Constants2.default.MUXED){msg='Multiplexed representations are intentionally not supported, as they are not compliant with the DASH-AVC/264 guidelines';logger.fatal(msg);errHandler.error(new _DashJSError2.default(_Errors2.default.MANIFEST_ERROR_ID_MULTIPLEXED_CODE,msg,manifestModel.getValue()));return false;}if(type===_Constants2.default.TEXT||type===_Constants2.default.FRAGMENTED_TEXT||type===_Constants2.default.EMBEDDED_TEXT||type===_Constants2.default.IMAGE){return true;}codec=mediaInfo.codec;logger.debug(type+' codec: '+codec);if(!!mediaInfo.contentProtection&&!capabilities.supportsEncryptedMedia()){errHandler.error(new _DashJSError2.default(_Errors2.default.CAPABILITY_MEDIAKEYS_ERROR_CODE,_Errors2.default.CAPABILITY_MEDIAKEYS_ERROR_MESSAGE));}else if(!capabilities.supportsCodec(codec)){msg=type+'Codec ('+codec+') is not supported.';logger.error(msg);return false;}return true;}function onCurrentTrackChanged(e){if(!streamInfo||e.newMediaInfo.streamInfo.id!==streamInfo.id)return;var mediaInfo=e.newMediaInfo;var manifest=manifestModel.getValue();adapter.setCurrentMediaInfo(streamInfo.id,mediaInfo.type,mediaInfo);var processor=getProcessorForMediaInfo(mediaInfo);if(!processor)return;var currentTime=playbackController.getTime();logger.info('Stream -  Process track changed at current time '+currentTime);logger.debug('Stream -  Update stream controller');if(manifest.refreshManifestOnSwitchTrack){// Applies only for MSS streams
logger.debug('Stream -  Refreshing manifest for switch track');trackChangedEvent=e;manifestUpdater.refreshManifest();}else{processor.selectMediaInfo(mediaInfo);if(mediaInfo.type!==_Constants2.default.FRAGMENTED_TEXT){abrController.updateTopQualityIndex(mediaInfo);processor.switchTrackAsked();processor.getFragmentModel().abortRequests();}else{processor.getScheduleController().setSeekTarget(currentTime);processor.setBufferingTime(currentTime);processor.resetIndexHandler();}}}function createStreamProcessor(mediaInfo,allMediaForType,mediaSource,optionalSettings){var fragmentModel=fragmentController.getModel(mediaInfo?mediaInfo.type:null);var streamProcessor=(0,_StreamProcessor2.default)(context).create({streamInfo:streamInfo,type:mediaInfo?mediaInfo.type:null,mimeType:mediaInfo?mediaInfo.mimeType:null,timelineConverter:timelineConverter,adapter:adapter,manifestModel:manifestModel,mediaPlayerModel:mediaPlayerModel,fragmentModel:fragmentModel,dashMetrics:config.dashMetrics,baseURLController:config.baseURLController,abrController:abrController,playbackController:playbackController,mediaController:mediaController,textController:textController,errHandler:errHandler,settings:settings,boxParser:boxParser});streamProcessor.initialize(mediaSource,hasVideoTrack);abrController.updateTopQualityIndex(mediaInfo);if(optionalSettings){streamProcessor.setBuffer(optionalSettings.buffer);streamProcessor.setBufferingTime(optionalSettings.currentTime);streamProcessors[optionalSettings.replaceIdx]=streamProcessor;}else{streamProcessors.push(streamProcessor);}if(optionalSettings&&optionalSettings.ignoreMediaInfo){return;}if(mediaInfo&&(mediaInfo.type===_Constants2.default.TEXT||mediaInfo.type===_Constants2.default.FRAGMENTED_TEXT)){var idx=void 0;for(var i=0;i<allMediaForType.length;i++){if(allMediaForType[i].index===mediaInfo.index){idx=i;}streamProcessor.addMediaInfo(allMediaForType[i]);//creates text tracks for all adaptations in one stream processor
}streamProcessor.selectMediaInfo(allMediaForType[idx]);//sets the initial media info
}else{streamProcessor.addMediaInfo(mediaInfo,true);}}function initializeMediaForType(type,mediaSource){var allMediaForType=adapter.getAllMediaInfoForType(streamInfo,type);var mediaInfo=null;var initialMediaInfo=void 0;if(!allMediaForType||allMediaForType.length===0){logger.info('No '+type+' data.');return;}if(type===_Constants2.default.VIDEO){hasVideoTrack=true;}if(type===_Constants2.default.AUDIO){hasAudioTrack=true;}for(var i=0,ln=allMediaForType.length;i<ln;i++){mediaInfo=allMediaForType[i];if(type===_Constants2.default.EMBEDDED_TEXT){textController.addEmbeddedTrack(mediaInfo);}else{if(!isMediaSupported(mediaInfo))continue;mediaController.addTrack(mediaInfo);}}if(type===_Constants2.default.EMBEDDED_TEXT||mediaController.getTracksFor(type,streamInfo).length===0){return;}if(type===_Constants2.default.IMAGE){thumbnailController=(0,_ThumbnailController2.default)(context).create({streamInfo:streamInfo,adapter:adapter,baseURLController:config.baseURLController,timelineConverter:config.timelineConverter,debug:debug,eventBus:eventBus,events:_Events2.default,dashConstants:_DashConstants2.default});return;}mediaController.checkInitialMediaSettingsForType(type,streamInfo);initialMediaInfo=mediaController.getCurrentTrackFor(type,streamInfo);eventBus.trigger(_Events2.default.STREAM_INITIALIZING,{streamInfo:streamInfo,mediaInfo:mediaInfo});// TODO : How to tell index handler live/duration?
// TODO : Pass to controller and then pass to each method on handler?
createStreamProcessor(initialMediaInfo,allMediaForType,mediaSource);}function addInlineEvents(){if(eventController){var events=adapter.getEventsFor(streamInfo);eventController.addInlineEvents(events);}}function addInbandEvents(events){if(eventController){eventController.addInbandEvents(events);}}function initializeMedia(mediaSource,previousBuffers){checkConfig();var element=videoModel.getElement();addInlineEvents();isUpdating=true;filterCodecs(_Constants2.default.VIDEO);filterCodecs(_Constants2.default.AUDIO);if(!element||element&&/^VIDEO$/i.test(element.nodeName)){initializeMediaForType(_Constants2.default.VIDEO,mediaSource);}initializeMediaForType(_Constants2.default.AUDIO,mediaSource);initializeMediaForType(_Constants2.default.TEXT,mediaSource);initializeMediaForType(_Constants2.default.FRAGMENTED_TEXT,mediaSource);initializeMediaForType(_Constants2.default.EMBEDDED_TEXT,mediaSource);initializeMediaForType(_Constants2.default.MUXED,mediaSource);initializeMediaForType(_Constants2.default.IMAGE,mediaSource);//TODO. Consider initialization of TextSourceBuffer here if embeddedText, but no sideloadedText.
var buffers=createBuffers(previousBuffers);isMediaInitialized=true;isUpdating=false;if(streamProcessors.length===0){var msg='No streams to play.';errHandler.error(new _DashJSError2.default(_Errors2.default.MANIFEST_ERROR_ID_NOSTREAMS_CODE,msg,manifestModel.getValue()));logger.fatal(msg);}else{checkIfInitializationCompleted();}return buffers;}function initializeAfterPreload(){isUpdating=true;checkConfig();filterCodecs(_Constants2.default.VIDEO);filterCodecs(_Constants2.default.AUDIO);isMediaInitialized=true;isUpdating=false;if(streamProcessors.length===0){var msg='No streams to play.';errHandler.error(new _DashJSError2.default(_Errors2.default.MANIFEST_ERROR_ID_NOSTREAMS_CODE,msg,manifestModel.getValue()));logger.debug(msg);}else{checkIfInitializationCompleted();}}function filterCodecs(type){var realAdaptation=adapter.getAdaptationForType(streamInfo?streamInfo.index:null,type,streamInfo);if(!realAdaptation||!Array.isArray(realAdaptation.Representation_asArray))return;// Filter codecs that are not supported
realAdaptation.Representation_asArray=realAdaptation.Representation_asArray.filter(function(_,i){// keep at least codec from lowest representation
if(i===0)return true;var codec=adapter.getCodec(realAdaptation,i,true);if(!capabilities.supportsCodec(codec)){logger.error('[Stream] codec not supported: '+codec);return false;}return true;});}function checkIfInitializationCompleted(){var ln=streamProcessors.length;var hasError=!!updateError.audio||!!updateError.video;var error=hasError?new _DashJSError2.default(_Errors2.default.DATA_UPDATE_FAILED_ERROR_CODE,_Errors2.default.DATA_UPDATE_FAILED_ERROR_MESSAGE):null;for(var i=0;i<ln;i++){if(streamProcessors[i].isUpdating()||isUpdating){return;}}if(!isMediaInitialized){return;}if(protectionController){// Need to check if streamProcessors exists because streamProcessors
// could be cleared in case an error is detected while initializing DRM keysystem
for(var _i2=0;_i2<ln&&streamProcessors[_i2];_i2++){if(streamProcessors[_i2].getType()===_Constants2.default.AUDIO||streamProcessors[_i2].getType()===_Constants2.default.VIDEO||streamProcessors[_i2].getType()===_Constants2.default.FRAGMENTED_TEXT){var mediaInfo=streamProcessors[_i2].getMediaInfo();if(mediaInfo){protectionController.initializeForMedia(mediaInfo);}}}}if(error){errHandler.error(error);}else if(!isStreamInitialized){isStreamInitialized=true;timelineConverter.setTimeSyncCompleted(true);eventBus.trigger(_Events2.default.STREAM_INITIALIZED,{streamInfo:streamInfo,liveStartTime:!preloaded?getLiveStartTime():NaN});}// (Re)start ScheduleController:
// - in case stream initialization has been completed after 'play' event (case for SegmentBase streams)
// - in case stream is complete but a track switch has been requested
for(var _i3=0;_i3<ln&&streamProcessors[_i3];_i3++){streamProcessors[_i3].getScheduleController().start();}}function getMediaInfo(type){var streamProcessor=null;for(var i=0;i<streamProcessors.length;i++){streamProcessor=streamProcessors[i];if(streamProcessor.getType()===type){return streamProcessor.getMediaInfo();}}return null;}function createBuffers(previousBuffers){var buffers={};for(var i=0,ln=streamProcessors.length;i<ln;i++){var buffer=streamProcessors[i].createBuffer(previousBuffers);if(buffer){buffers[streamProcessors[i].getType()]=buffer.getBuffer();}}return buffers;}function onBufferingCompleted(){var processors=getProcessors();var ln=processors.length;if(ln===0){logger.warn('onBufferingCompleted - can\'t trigger STREAM_BUFFERING_COMPLETED because no streamProcessor is defined');return;}// if there is at least one buffer controller that has not completed buffering yet do nothing
for(var i=0;i<ln;i++){//if audio or video buffer is not buffering completed state, do not send STREAM_BUFFERING_COMPLETED
if(!processors[i].isBufferingCompleted()&&(processors[i].getType()===_Constants2.default.AUDIO||processors[i].getType()===_Constants2.default.VIDEO)){logger.warn('onBufferingCompleted - One streamProcessor has finished but',processors[i].getType(),'one is not buffering completed');return;}}logger.debug('onBufferingCompleted - trigger STREAM_BUFFERING_COMPLETED');eventBus.trigger(_Events2.default.STREAM_BUFFERING_COMPLETED,{streamInfo:streamInfo});}function onDataUpdateCompleted(e){updateError[e.mediaType]=e.error;checkIfInitializationCompleted();}function onInbandEvents(e){addInbandEvents(e.events);}function getProcessorForMediaInfo(mediaInfo){if(!mediaInfo){return null;}var processors=getProcessors();return processors.filter(function(processor){return processor.getType()===mediaInfo.type;})[0];}function getProcessors(){var arr=[];var type=void 0,streamProcessor=void 0;for(var i=0;i<streamProcessors.length;i++){streamProcessor=streamProcessors[i];type=streamProcessor.getType();if(type===_Constants2.default.AUDIO||type===_Constants2.default.VIDEO||type===_Constants2.default.FRAGMENTED_TEXT||type===_Constants2.default.TEXT){arr.push(streamProcessor);}}return arr;}function updateData(updatedStreamInfo){logger.info('Manifest updated... updating data system wide.');isStreamActivated=false;isUpdating=true;streamInfo=updatedStreamInfo;eventBus.trigger(_Events2.default.STREAM_UPDATED,{streamInfo:streamInfo});if(eventController){addInlineEvents();}filterCodecs(_Constants2.default.VIDEO);filterCodecs(_Constants2.default.AUDIO);for(var i=0,ln=streamProcessors.length;i<ln;i++){var streamProcessor=streamProcessors[i];streamProcessor.updateStreamInfo(streamInfo);var mediaInfo=adapter.getMediaInfoForType(streamInfo,streamProcessor.getType());// Check if AdaptationSet has not been removed in MPD update
if(mediaInfo){abrController.updateTopQualityIndex(mediaInfo);streamProcessor.addMediaInfo(mediaInfo,true);}}if(trackChangedEvent){var _mediaInfo=trackChangedEvent.newMediaInfo;if(_mediaInfo.type!==_Constants2.default.FRAGMENTED_TEXT){var processor=getProcessorForMediaInfo(trackChangedEvent.oldMediaInfo);if(!processor)return;processor.switchTrackAsked();trackChangedEvent=undefined;}}isUpdating=false;checkIfInitializationCompleted();}function isMediaCodecCompatible(newStream){var previousStream=arguments.length>1&&arguments[1]!==undefined?arguments[1]:null;return compareCodecs(newStream,_Constants2.default.VIDEO,previousStream)&&compareCodecs(newStream,_Constants2.default.AUDIO,previousStream);}function isProtectionCompatible(stream){var previousStream=arguments.length>1&&arguments[1]!==undefined?arguments[1]:null;return compareProtectionConfig(stream,_Constants2.default.VIDEO,previousStream)&&compareProtectionConfig(stream,_Constants2.default.AUDIO,previousStream);}function compareProtectionConfig(stream,type){var previousStream=arguments.length>2&&arguments[2]!==undefined?arguments[2]:null;if(!stream){return false;}var newStreamInfo=stream.getStreamInfo();var currentStreamInfo=previousStream?previousStream.getStreamInfo():getStreamInfo();if(!newStreamInfo||!currentStreamInfo){return false;}var newAdaptation=adapter.getAdaptationForType(newStreamInfo.index,type,newStreamInfo);var currentAdaptation=adapter.getAdaptationForType(currentStreamInfo.index,type,currentStreamInfo);if(!newAdaptation||!currentAdaptation){// If there is no adaptation for neither the old or the new stream they're compatible
return!newAdaptation&&!currentAdaptation;}// If the current period is unencrypted and the upcoming one is encrypted we need to reset sourcebuffers.
return!(!isAdaptationDrmProtected(currentAdaptation)&&isAdaptationDrmProtected(newAdaptation));}function isAdaptationDrmProtected(adaptation){if(!adaptation){// If there is no adaptation for neither the old or the new stream they're compatible
return false;}// If the current period is unencrypted and the upcoming one is encrypted we need to reset sourcebuffers.
return!!(adaptation.ContentProtection||adaptation.Representation&&adaptation.Representation.length>0&&adaptation.Representation[0].ContentProtection);}function compareCodecs(newStream,type){var previousStream=arguments.length>2&&arguments[2]!==undefined?arguments[2]:null;if(!newStream||!newStream.hasOwnProperty('getStreamInfo')){return false;}var newStreamInfo=newStream.getStreamInfo();var currentStreamInfo=previousStream?previousStream.getStreamInfo():getStreamInfo();if(!newStreamInfo||!currentStreamInfo){return false;}var newAdaptation=adapter.getAdaptationForType(newStreamInfo.index,type,newStreamInfo);var currentAdaptation=adapter.getAdaptationForType(currentStreamInfo.index,type,currentStreamInfo);if(!newAdaptation||!currentAdaptation){// If there is no adaptation for neither the old or the new stream they're compatible
return!newAdaptation&&!currentAdaptation;}var sameMimeType=newAdaptation&&currentAdaptation&&newAdaptation.mimeType===currentAdaptation.mimeType;var oldCodecs=currentAdaptation.Representation_asArray.map(function(representation){return representation.codecs;});var newCodecs=newAdaptation.Representation_asArray.map(function(representation){return representation.codecs;});var codecMatch=newCodecs.some(function(newCodec){return oldCodecs.indexOf(newCodec)>-1;});var partialCodecMatch=newCodecs.some(function(newCodec){return oldCodecs.some(function(oldCodec){return codecRootCompatibleWithCodec(oldCodec,newCodec);});});return codecMatch||partialCodecMatch&&sameMimeType;}// Check if the root of the old codec is the same as the new one, or if it's declared as compatible in the compat table
function codecRootCompatibleWithCodec(codec1,codec2){var codecRoot=codec1.split('.')[0];var rootCompatible=codec2.indexOf(codecRoot)===0;var compatTableCodec=void 0;for(var i=0;i<codecCompatibilityTable.length;i++){if(codecCompatibilityTable[i].codec===codecRoot){compatTableCodec=codecCompatibilityTable[i];break;}}if(compatTableCodec){return rootCompatible||compatTableCodec.compatibleCodecs.some(function(compatibleCodec){return codec2.indexOf(compatibleCodec)===0;});}return rootCompatible;}function setPreloaded(value){preloaded=value;}function getPreloaded(){return preloaded;}function preload(mediaSource,previousBuffers){if(!getPreloaded()){addInlineEvents();initializeMediaForType(_Constants2.default.VIDEO,mediaSource);initializeMediaForType(_Constants2.default.AUDIO,mediaSource);initializeMediaForType(_Constants2.default.TEXT,mediaSource);initializeMediaForType(_Constants2.default.FRAGMENTED_TEXT,mediaSource);initializeMediaForType(_Constants2.default.EMBEDDED_TEXT,mediaSource);initializeMediaForType(_Constants2.default.MUXED,mediaSource);initializeMediaForType(_Constants2.default.IMAGE,mediaSource);createBuffers(previousBuffers);eventBus.on(_Events2.default.CURRENT_TRACK_CHANGED,onCurrentTrackChanged,instance);for(var i=0;i<streamProcessors.length&&streamProcessors[i];i++){streamProcessors[i].getScheduleController().start();}setPreloaded(true);}}instance={initialize:initialize,getStreamId:getStreamId,activate:activate,deactivate:deactivate,isActive:isActive,getDuration:getDuration,getStartTime:getStartTime,getId:getId,getStreamInfo:getStreamInfo,getHasAudioTrack:getHasAudioTrack,getHasVideoTrack:getHasVideoTrack,preload:preload,getThumbnailController:getThumbnailController,getBitrateListFor:getBitrateListFor,updateData:updateData,reset:reset,getProcessors:getProcessors,setMediaSource:setMediaSource,isMediaCodecCompatible:isMediaCodecCompatible,isProtectionCompatible:isProtectionCompatible,getPreloaded:getPreloaded,getPreloadingScheduled:getPreloadingScheduled,setPreloadingScheduled:setPreloadingScheduled,getIsEndedEventSignaled:getIsEndedEventSignaled,setIsEndedEventSignaled:setIsEndedEventSignaled};setup();return instance;}/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */Stream.__dashjs_factory_name='Stream';exports.default=_FactoryMaker2.default.getClassFactory(Stream);
//# sourceMappingURL=Stream.js.map
