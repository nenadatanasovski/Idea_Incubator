
<script runat="server" language="JavaScript">
Platform.Load("Core","1");
var userEnv = Platform.Variable.GetValue("@userEnv");
var logDE =  userEnv == 'UAT' ? 'CAPI_Curated_Collection_Log_UAT' : 'CAPI_Curated_Collection_Log';
var collectionDE =  userEnv == 'UAT' ? 'CAPI_Curated_Collection_Data_UAT' : 'CAPI_Curated_Collection_Data';
var pageID = userEnv == 'UAT' ? 'CAPI_Feed_CollectID_API_UAT' : 'CAPI_Feed_CollectID_API';
var eventGUID = GUID();
var currentTime = DateTime.SystemDateToLocalDate(Now());
var message = "";
var capiRespJson = {};
var modEmailJson = {};
var response = {};
var status = {};
var mastHead;
var domainLinkValue;
var collID;
var collStatus;
var headline;
var isDraft;
var capiUri;
var processStage;
var jsonpost;
var objJSON;
var collCont = {};
var collections = [];
var resp;
var articleCounter = 0;

try {
    /* parsing json payload header */
    var authKey_capi = Platform.Request.GetRequestHeader("x-auth-nca");
    var authKey_SFMC = Platform.Function.Lookup('API_Keys','Key',['Id','Active'], [pageID,'True']);

    /* parsing json payload */
    jsonpost = Platform.Request.GetPostData();
    objJSON = Platform.Function.ParseJSON(jsonpost);
    processStage = "Security Key validation started.";
    
    if(authKey_capi == authKey_SFMC)
    {
        collID      = objJSON.capiId;
        collStatus  = objJSON.status;
        isDraft     = objJSON.draft;
        processStage = "Live datetime and current datetime validation begins.";
		var live = objJSON.date.live;
		var live_date = new Date(live);
		var serverCurrentTime = new Date();
		
		if(live_date <= serverCurrentTime)
		{
			processStage = "Live datetime and current datetime validation completed.";
	        /*var capiUri     = objJSON.capiUri + "?size=10&api_key=efwfduhaq3jjrjngztyg5s8y";*/
	        /*capiUri     = "https://client.api.news/collections/" + collID;*/
	        capiUri     = "https://content.api.news/v3/collections/"+ collID +"?api_key=efwfduhaq3jjrjngztyg5s8y&fullReferences=true";
	        processStage = "Validating the status & draft flags from CAPI Feed API Payload.";
	        
	        if(collStatus == 'active' && isDraft == false)
	        {
	            processStage = "Collection data retrieve request call initiating.";
	            var req = new Script.Util.HttpGet(capiUri);
	            resp = req.send();
	            processStage = "Received response from CAPI with the collection data.";
	            capiRespJson = Platform.Function.ParseJSON(String(resp.content));
	            collCont = Platform.Function.ParseJSON(String(resp.content));
	            processStage = "Able to parse the CAPI collection data.";

	            /*
	            var vidoraApiKeyRows = Platform.Function.LookupRows('Vidora_APIKeys','AppC_Support','True');        
	            for (i = 0; i < vidoraApiKeyRows.length; i++) 
	            {
	                mastHead = vidoraApiKeyRows[i]["Masthead"];
	                domainLinkValue = vidoraApiKeyRows[i]["DomainLink"];
	                for(var key in modEmailJson.content.references)
	                {
	                    if(modEmailJson.content.references[key].target.domainLink[domainLinkValue] != null)
	                    {
	                        modEmailJson.content.references[key].target.domainLink[mastHead] =  modEmailJson.content.references[key].target.domainLink[domainLinkValue];
	                        delete modEmailJson.content.references[key].target.domainLink[domainLinkValue];
	                    }
	                }
	            }
	            processStage = "Successfully replaced domain links using the data in Vidora API Keys.";
	            */

	            headline = collCont.content.headline["default"];
				for(var i=0;i<collCont.content.related.primary["default"].length;i++)
				{
			      	var artCont = collCont.content.references[collCont.content.related.primary["default"][i]];
			      	if (artCont != undefined)
			      	{
						var tmpColl = {
							id: artCont.id,
							type: artCont.type,
							platformId: artCont.platform.id,
							title: artCont.headline["default"],
							standfirst: artCont.standfirst["default"],
							paidStatus: artCont.accessType,
							kicker: artCont.kicker["default"],
							liveDate: artCont.date.live,
							updatedDate: artCont.date.updated,
							customDate: artCont.date.custom,
							isCommentary: artCont.commentsAllowed["default"],
							commentsShown: artCont.commentsShown["default"],
							canonicalLink: artCont.link.canonical,
							status: artCont.status,
							originatedSource: artCont.rightsMetadata.originatedSource,
							byline: artCont.byline["default"],	
							platform: artCont.platform.system,
							links: artCont.target.domainLink,
							description: artCont.intro["default"]
						};
	/*
						var links = [];
						for(var key in artCont.target.domainLink)
			            {
			            	var vidoraMasthead = Platform.Function.Lookup('Vidora_APIKeys', 'Masthead', ['DomainLink','AppC_Support'],[key,'True'] );    

			            	var li = {
			            		masthead: ((vidoraMasthead != "" && vidoraMasthead != null ) ? vidoraMasthead : key) ,
			            		url: artCont.target.domainLink[key].link
			            	}
			                links.push(li);
			            }
			          	tmpColl.links = links;
	*/
						var path = '';
				        for(var j=0;j<artCont.target.sections.length;j++) 
				        {
				            path = path + "|||" + artCont.target.sections[j].path;
				        }

				        tmpColl.path = path;

				        if(artCont.type == 'video') 
				        {
			        		for(var j=0;j<artCont.related.primary["default"].length;j++) {
				            	var aspectRatio = artCont.references[artCont.related.primary["default"][j]].aspectRatio;
				            	if(aspectRatio == "16:9") {
					             	tmpColl.thumbnail16x9 = artCont.references[artCont.related.primary["default"][j]].link.media;
					             	break;
			            		}
				           	}

				        	var counter = 1;
				           	for(var j=0;j<artCont.related.primary["default"].length;j++) {
					            var aspectRatio = artCont.references[artCont.related.primary["default"][j]].aspectRatio;
					            if(aspectRatio == "16:9") {
				              		tmpColl.thumbnail4x3 = artCont.references[artCont.related.primary["default"][j]].link.media;
					              	break;
					             	counter++
					            }
				           	}

				           	var counter = 1;
				           	for(var j=0;j<artCont.related.primary["default"].length;j++) {
				            	var aspectRatio = artCont.references[artCont.related.primary["default"][j]].aspectRatio;
				            	if(aspectRatio == "5:3") {
				              		tmpColl.thumbnail5x3 = artCont.references[artCont.related.primary["default"][j]].link.media;
				              		break;
				             		counter++
				            	}
				           	}
				           	
				           	if((tmpColl.thumbnail16x9 == null || tmpColl.thumbnail16x9 == undefined) && (tmpColl.thumbnail4x3 == null || tmpColl.thumbnail4x3 == undefined)) 
				           	{
								for(var j=0;j<artCont.related.thumbnail["default"].length;j++) 
								{
									var width = artCont.references[artCont.related.thumbnail["default"][j]].width;
									if(width > 300) 
									{
										tmpColl.thumbnail16x9 = artCont.references[artCont.related.thumbnail["default"][j]].link.media;
										tmpColl.thumbnail4x3 = artCont.references[artCont.related.thumbnail["default"][j]].link.media;
										break;
									}
								}
				            }
				        } 
				        else 
				        {
				            for(var j=0;j<artCont.related.thumbnail["default"].length;j++) 
				            {
								var aspectRatio = artCont.references[artCont.related.thumbnail["default"][j]].aspectRatio;
								var width = artCont.references[artCont.related.thumbnail["default"][j]].width;
								if(aspectRatio == "16:9" && width > 300) 
								{
									tmpColl.thumbnail16x9 = artCont.references[artCont.related.thumbnail["default"][j]].link.media;
									break;
								}
				            }
				            
				            for(var j=0;j<artCont.related.thumbnail["default"].length;j++) 
				            {
								var aspectRatio = artCont.references[artCont.related.thumbnail["default"][j]].aspectRatio;
								var width = artCont.references[artCont.related.thumbnail["default"][j]].width;
								if(aspectRatio == "4:3" && width > 300) 
								{
									tmpColl.thumbnail4x3 = artCont.references[artCont.related.thumbnail["default"][j]].link.media;
									break;
								}
				            }

				            for(var j=0;j<artCont.related.primary["default"].length;j++) 
				            {
								var aspectRatio = artCont.references[artCont.related.primary["default"][j]].aspectRatio;
								var width = artCont.references[artCont.related.primary["default"][j]].width;
								if(aspectRatio == "5:3" && width > 300) {
									tmpColl.thumbnail16x9 = artCont.references[artCont.related.primary["default"][j]].link.media;
									break;
								}
				            }
				            
				            if((tmpColl.thumbnail16x9 == null || tmpColl.thumbnail16x9 == undefined) && (tmpColl.thumbnail4x3 == null || tmpColl.thumbnail4x3 == undefined)) 
				            {
								for(var j=0;j<artCont.related.primary["default"].length;j++) 
								{
									var width = artCont.references[artCont.related.primary["default"][j]].width;
									if(width > 300) {
										tmpColl.thumbnail16x9 = artCont.references[artCont.related.primary["default"][j]].link.media;
										tmpColl.thumbnail4x3 = artCont.references[artCont.related.primary["default"][j]].link.media;
										break;
									}
								}
				            }
				        }
				        
				        collections.push(tmpColl);
				        articleCounter = articleCounter + 1;
			      	}
			    }

			    var response = { data: collections };
	            var collID_Lookup = Platform.Function.Lookup(collectionDE, "CAPI_collection_id", "CAPI_collection_id", collID);

	            if(collID_Lookup != null && collID_Lookup != '') 
	            {
	                processStage = "Updating the Curated collection data.";
	                message = "Collection data updated successfully.";

	                /*Updating the Collection Data with updated date */
	            	Platform.Function.UpdateData(collectionDE, ["CAPI_collection_id"], [collID],["CAPI_Collection_JSON", "source", "updated_date", "latest_event_id", "Simplified_Email_JSON", "headline", "No_of_Articles"],[Stringify(capiRespJson), "CAPI V3", currentTime, eventGUID, Stringify(response), headline, articleCounter]);
	            }
	            else
	            {
	                processStage = "Saving the Curated collection data.";
	                message = "Collection data saved successfully.";

	                /*Insert the Collection Data with created date*/
	            	Platform.Function.InsertData(collectionDE, ["CAPI_collection_id", "CAPI_Collection_JSON", "source", "created_date", "updated_date", "latest_event_id", "Simplified_Email_JSON", "headline", "No_of_Articles"],[collID, Stringify(capiRespJson), "CAPI V3", currentTime, currentTime, eventGUID, Stringify(response), headline], articleCounter);
	            }
	        }
	        else if(collStatus == "deleted" || collStatus == "killed" || collStatus == "inactive" || collStatus == "expired" || isDraft == true)
	        {
	            processStage = "Collection status matched to either deleted/killed/inactive/expired or it is in draft stage.";
	            var dr = Platform.Function.Lookup(collectionDE, "CAPI_collection_id", "CAPI_collection_id", collID);

	            if(dr && dr.length > 0) 
	            {
	                processStage = "Collection data is deleting.";
	                message = "Collection data has been deleted.";

	                /* 410 error code is used for "(Gone) Data is in Not Acceptable format" */
	            	var error_json = { errCode: 410, errMessage: message };

	                /*Updating the Collection Data with updated date*/
	            	Platform.Function.UpdateData(collectionDE, ["CAPI_collection_id"], [collID],["updated_date", "latest_event_id", "Simplified_Email_JSON", "No_of_Articles"],[currentTime, eventGUID, Stringify(error_json), 0]);
	                
	               /* delete the collection ID
	                var rows = Platform.Function.DeleteData(collectionDE,['CAPI_collection_id'],[collID]);
	               */
	            	processStage = "Collection data removed.";
	                message = "Collection data removed successfully.";
	            }
	            else
	            {
	                processStage = "Collection data not found in the collection data DE.";
	                message = "Collection data already deleted or does not exists in SFMC.";
	            }
	        }
	        else
	        {
	            processStage = "Collection status not matched.";
	            message = "Invalid request.";

	            /* 406 error code is used for "(Not Acceptable) Data is in Not Acceptable format" */
	            var error_json = { errCode: 406, errMessage: message };

			    /*Upserting the Collection Data with updated date*/
				Platform.Function.UpdateData(collectionDE, ["CAPI_collection_id"], [collID],["CAPI_Collection_JSON", "source", "updated_date", "latest_event_id", "Simplified_Email_JSON", "headline", "No_of_Articles"],[Stringify(capiRespJson), "CAPI V3", currentTime, eventGUID, Stringify(error_json), headline, 0]);
	        }
        }
		else
		{
			processStage = "Live datetime and current datetime validation completed.";
			message = "Collection caching process is terminating as collection is not live yet, current time in SFMC:" + serverCurrentTime + ". & live date: " + live_date + ".";

			/* 404 error code is used for "(Not Found) The server cannot find the requested resource" */
			var error_json = { errCode: 404, errMessage: message };

		    /*Upserting the Collection Data with updated date*/
			Platform.Function.UpdateData(collectionDE, ["CAPI_collection_id"], [collID],["CAPI_Collection_JSON", "source", "updated_date", "latest_event_id", "Simplified_Email_JSON", "headline", "No_of_Articles"],[Stringify(capiRespJson), "CAPI V3", currentTime, eventGUID, Stringify(error_json), headline, 0 ]);
		}
    }
    else
    {
        processStage = "Auth Key validation was failed.";
        message = "Invalid auth key in the request.";
    }

    processStage = "Creating the log after the Save/update/delete operations.";

    /*Creating a Log */
	Platform.Function.InsertData(logDE,["event_id", "CAPI_collection_id", "message", "capi_payload", "result", "created_date", "updated_date"],[ eventGUID, collID, message, Stringify(objJSON), processStage, currentTime, currentTime ]);
	Write('{"responses":[{"eventId": "'+ eventGUID +'", "hasErrors": "false", "message": "'+ message +'"}]}');
}
catch(e)
{
    message = e.message + Stringify(resp);
    processStage = "Runtime error occured. Last process stage was." + processStage;

    /* 500 error code is used for "(Internal Server Error) The server has encountered a situation it does not know how to handle" */
    var error_json = { errCode: 500, errMessage: message };

    /*Upserting the Collection Data with updated date*/
	Platform.Function.UpsertData(collectionDE, ["CAPI_collection_id"], [collID],["CAPI_Collection_JSON", "source", "updated_date", "latest_event_id", "Simplified_Email_JSON", "headline", "No_of_Articles"],[Stringify(capiRespJson), "CAPI V3", currentTime, eventGUID, Stringify(error_json), headline, 0]);

    /*Creating a Log*/
    Platform.Function.InsertData(logDE,["event_id", "CAPI_collection_id", "message", "capi_payload", "result", "created_date", "updated_date"],[ eventGUID, collID, message, Stringify(objJSON), processStage, currentTime, currentTime ]);

    Write('{"responses":[{"eventId": "'+ eventGUID +'", "hasErrors": "true", "message": "'+ message +'"}]}');
}
</script>