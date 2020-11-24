'use strict';Object.defineProperty(exports,"__esModule",{value:true});var _FragmentRequest=require('../streaming/vo/FragmentRequest');var _FragmentRequest2=_interopRequireDefault(_FragmentRequest);var _HTTPRequest=require('../streaming/vo/metrics/HTTPRequest');var _FactoryMaker=require('../core/FactoryMaker');var _FactoryMaker2=_interopRequireDefault(_FactoryMaker);var _SegmentsUtils=require('./utils/SegmentsUtils');var _SegmentsController=require('./controllers/SegmentsController');var _SegmentsController2=_interopRequireDefault(_SegmentsController);function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function DashHandler(config){config=config||{};var context=this.context;var eventBus=config.eventBus;var events=config.events;var debug=config.debug;var dashConstants=config.dashConstants;var urlUtils=config.urlUtils;var type=config.type;var streamInfo=config.streamInfo;var timelineConverter=config.timelineConverter;var dashMetrics=config.dashMetrics;var baseURLController=config.baseURLController;var instance=void 0,logger=void 0,segmentIndex=void 0,lastSegment=void 0,requestedTime=void 0,isDynamicManifest=void 0,dynamicStreamCompleted=void 0,selectedMimeType=void 0,segmentsController=void 0;function setup(){logger=debug.getLogger(instance);resetInitialSettings();segmentsController=(0,_SegmentsController2.default)(context).create(config);eventBus.on(events.INITIALIZATION_LOADED,onInitializationLoaded,instance);eventBus.on(events.SEGMENTS_LOADED,onSegmentsLoaded,instance);eventBus.on(events.REPRESENTATION_UPDATE_STARTED,onRepresentationUpdateStarted,instance);eventBus.on(events.DYNAMIC_TO_STATIC,onDynamicToStatic,instance);}function initialize(isDynamic){isDynamicManifest=isDynamic;dynamicStreamCompleted=false;segmentsController.initialize(isDynamic);}function getStreamId(){return streamInfo.id;}function getType(){return type;}function getStreamInfo(){return streamInfo;}function setCurrentIndex(value){segmentIndex=value;}function getCurrentIndex(){return segmentIndex;}function resetIndex(){segmentIndex=-1;lastSegment=null;}function resetInitialSettings(){resetIndex();requestedTime=null;segmentsController=null;selectedMimeType=null;}function reset(){resetInitialSettings();eventBus.off(events.INITIALIZATION_LOADED,onInitializationLoaded,instance);eventBus.off(events.SEGMENTS_LOADED,onSegmentsLoaded,instance);eventBus.off(events.REPRESENTATION_UPDATE_STARTED,onRepresentationUpdateStarted,instance);eventBus.off(events.DYNAMIC_TO_STATIC,onDynamicToStatic,instance);}function setRequestUrl(request,destination,representation){var baseURL=baseURLController.resolve(representation.path);var url=void 0,serviceLocation=void 0;if(!baseURL||destination===baseURL.url||!urlUtils.isRelative(destination)){url=destination;}else{url=baseURL.url;serviceLocation=baseURL.serviceLocation;if(destination){url=urlUtils.resolve(destination,url);}}if(urlUtils.isRelative(url)){return false;}request.url=url;request.serviceLocation=serviceLocation;return true;}function generateInitRequest(mediaInfo,representation,mediaType){var request=new _FragmentRequest2.default();var period=representation.adaptation.period;var presentationStartTime=period.start;request.mediaType=mediaType;request.type=_HTTPRequest.HTTPRequest.INIT_SEGMENT_TYPE;request.range=representation.range;request.availabilityStartTime=timelineConverter.calcAvailabilityStartTimeFromPresentationTime(presentationStartTime,period.mpd,isDynamicManifest);request.availabilityEndTime=timelineConverter.calcAvailabilityEndTimeFromPresentationTime(presentationStartTime+period.duration,period.mpd,isDynamicManifest);request.quality=representation.index;request.mediaInfo=mediaInfo;request.representationId=representation.id;if(setRequestUrl(request,representation.initialization,representation)){request.url=(0,_SegmentsUtils.replaceTokenForTemplate)(request.url,'Bandwidth',representation.bandwidth);return request;}}function getInitRequest(mediaInfo,representation){if(!representation)return null;var request=generateInitRequest(mediaInfo,representation,getType());return request;}function setMimeType(newMimeType){selectedMimeType=newMimeType;}function setExpectedLiveEdge(liveEdge){timelineConverter.setExpectedLiveEdge(liveEdge);dashMetrics.updateManifestUpdateInfo({presentationStartTime:liveEdge});}function onRepresentationUpdateStarted(e){processRepresentation(e.representation);}function processRepresentation(voRepresentation){var hasInitialization=voRepresentation.hasInitialization();var hasSegments=voRepresentation.hasSegments();// If representation has initialization and segments information, REPRESENTATION_UPDATE_COMPLETED can be triggered immediately
// otherwise, it means that a request has to be made to get initialization and/or segments informations
if(hasInitialization&&hasSegments){eventBus.trigger(events.REPRESENTATION_UPDATE_COMPLETED,{representation:voRepresentation},{streamId:streamInfo.id,mediaType:type});}else{segmentsController.update(voRepresentation,selectedMimeType,hasInitialization,hasSegments);}}function getRequestForSegment(mediaInfo,segment){if(segment===null||segment===undefined){return null;}var request=new _FragmentRequest2.default();var representation=segment.representation;var bandwidth=representation.adaptation.period.mpd.manifest.Period_asArray[representation.adaptation.period.index].AdaptationSet_asArray[representation.adaptation.index].Representation_asArray[representation.index].bandwidth;var url=segment.media;url=(0,_SegmentsUtils.replaceTokenForTemplate)(url,'Number',segment.replacementNumber);url=(0,_SegmentsUtils.replaceTokenForTemplate)(url,'Time',segment.replacementTime);url=(0,_SegmentsUtils.replaceTokenForTemplate)(url,'Bandwidth',bandwidth);url=(0,_SegmentsUtils.replaceIDForTemplate)(url,representation.id);url=(0,_SegmentsUtils.unescapeDollarsInTemplate)(url);request.mediaType=getType();request.type=_HTTPRequest.HTTPRequest.MEDIA_SEGMENT_TYPE;request.range=segment.mediaRange;request.startTime=segment.presentationStartTime;request.duration=segment.duration;request.timescale=representation.timescale;request.availabilityStartTime=segment.availabilityStartTime;request.availabilityEndTime=segment.availabilityEndTime;request.wallStartTime=segment.wallStartTime;request.quality=representation.index;request.index=segment.availabilityIdx;request.mediaInfo=mediaInfo;request.adaptationIndex=representation.adaptation.index;request.representationId=representation.id;if(setRequestUrl(request,url,representation)){return request;}}function isMediaFinished(representation){var isFinished=false;if(!representation)return isFinished;if(!isDynamicManifest){if(segmentIndex>=representation.availableSegmentsNumber){isFinished=true;}}else{if(dynamicStreamCompleted){isFinished=true;}else if(lastSegment){var time=parseFloat((lastSegment.presentationStartTime-representation.adaptation.period.start).toFixed(5));var endTime=lastSegment.duration>0?time+1.5*lastSegment.duration:time;var duration=representation.adaptation.period.duration;isFinished=endTime>=duration;}}return isFinished;}function getSegmentRequestForTime(mediaInfo,representation,time,options){var request=null;if(!representation||!representation.segmentInfoType){return request;}var idx=segmentIndex;var keepIdx=options?options.keepIdx:false;var ignoreIsFinished=options&&options.ignoreIsFinished?true:false;if(requestedTime!==time){// When playing at live edge with 0 delay we may loop back with same time and index until it is available. Reduces verboseness of logs.
requestedTime=time;logger.debug('Getting the request for time : '+time);}var segment=segmentsController.getSegmentByTime(representation,time);if(segment){segmentIndex=segment.availabilityIdx;lastSegment=segment;logger.debug('Index for time '+time+' is '+segmentIndex);request=getRequestForSegment(mediaInfo,segment);}else{var finished=!ignoreIsFinished?isMediaFinished(representation):false;if(finished){request=new _FragmentRequest2.default();request.action=_FragmentRequest2.default.ACTION_COMPLETE;request.index=segmentIndex-1;request.mediaType=type;request.mediaInfo=mediaInfo;logger.debug('Signal complete in getSegmentRequestForTime');}}if(keepIdx&&idx>=0){segmentIndex=representation.segmentInfoType===dashConstants.SEGMENT_TIMELINE&&isDynamicManifest?segmentIndex:idx;}return request;}function getNextSegmentRequest(mediaInfo,representation){var request=null;if(!representation||!representation.segmentInfoType){return null;}requestedTime=null;var indexToRequest=segmentIndex+1;logger.debug('Getting the next request at index: '+indexToRequest);// check that there is a segment in this index
var segment=segmentsController.getSegmentByIndex(representation,indexToRequest,lastSegment?lastSegment.mediaStartTime:-1);if(!segment&&isEndlessMedia(representation)&&!dynamicStreamCompleted){logger.debug(getType()+' No segment found at index: '+indexToRequest+'. Wait for next loop');return null;}else{if(segment){request=getRequestForSegment(mediaInfo,segment);segmentIndex=segment.availabilityIdx;}else{if(isDynamicManifest){segmentIndex=indexToRequest-1;}else{segmentIndex=indexToRequest;}}}if(segment){lastSegment=segment;}else{var finished=isMediaFinished(representation,segment);if(finished){request=new _FragmentRequest2.default();request.action=_FragmentRequest2.default.ACTION_COMPLETE;request.index=segmentIndex-1;request.mediaType=getType();request.mediaInfo=mediaInfo;logger.debug('Signal complete');}}return request;}function isEndlessMedia(representation){return!isFinite(representation.adaptation.period.duration);}function onInitializationLoaded(e){var representation=e.representation;if(!representation.segments)return;eventBus.trigger(events.REPRESENTATION_UPDATE_COMPLETED,{representation:representation},{streamId:streamInfo.id,mediaType:type});}function onSegmentsLoaded(e){if(e.error)return;var fragments=e.segments;var representation=e.representation;var segments=[];var count=0;var i=void 0,len=void 0,s=void 0,seg=void 0;for(i=0,len=fragments?fragments.length:0;i<len;i++){s=fragments[i];seg=(0,_SegmentsUtils.getTimeBasedSegment)(timelineConverter,isDynamicManifest,representation,s.startTime,s.duration,s.timescale,s.media,s.mediaRange,count);if(seg){segments.push(seg);seg=null;count++;}}if(segments.length>0){representation.segmentAvailabilityRange={start:segments[0].presentationStartTime,end:segments[segments.length-1].presentationStartTime};representation.availableSegmentsNumber=segments.length;representation.segments=segments;if(isDynamicManifest){var _lastSegment=segments[segments.length-1];var liveEdge=_lastSegment.presentationStartTime-8;// the last segment is the Expected, not calculated, live edge.
setExpectedLiveEdge(liveEdge);}}if(!representation.hasInitialization()){return;}eventBus.trigger(events.REPRESENTATION_UPDATE_COMPLETED,{representation:representation},{streamId:streamInfo.id,mediaType:type});}function onDynamicToStatic(){logger.debug('Dynamic stream complete');dynamicStreamCompleted=true;}instance={initialize:initialize,getStreamId:getStreamId,getType:getType,getStreamInfo:getStreamInfo,getInitRequest:getInitRequest,getRequestForSegment:getRequestForSegment,getSegmentRequestForTime:getSegmentRequestForTime,getNextSegmentRequest:getNextSegmentRequest,setCurrentIndex:setCurrentIndex,getCurrentIndex:getCurrentIndex,isMediaFinished:isMediaFinished,reset:reset,resetIndex:resetIndex,setMimeType:setMimeType};setup();return instance;}/**
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
 */DashHandler.__dashjs_factory_name='DashHandler';exports.default=_FactoryMaker2.default.getClassFactory(DashHandler);
//# sourceMappingURL=DashHandler.js.map
