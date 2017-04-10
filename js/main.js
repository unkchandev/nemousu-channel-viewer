var debug = false;

var locationBaseUrl;
var communityNo;
var viewResNum;
var viewLastResNum;

var viewLastRes;

var ls = localStorage;

var autoReloadTimer;

var prevResAdjustTop;

// synchronized flag
var post = false;
$(document).ready(function(){
	// 接続タイムアウト設定
	$.ajaxSetup({ cache: false, timeout:15000 });
	
	// ベースとなるURLを取得
	var locationUrl = $(location).attr('href');
	locationBaseUrl = locationUrl.slice(0,locationUrl.lastIndexOf('/')+1);
	
	// お絵かきの場合は何もしない
	if(locationUrl.lastIndexOf('post_oekaki') > -1){
		return;
	}
		
	// コミュトップにアクセスされた場合
	 if(locationBaseUrl.lastIndexOf('http://com.nicovideo.jp') > -1){
		// コミュニティ番号を取得
		communityNo = locationUrl.slice(locationUrl.lastIndexOf('/co')+1,locationUrl.length);
		if(communityNo.lastIndexOf('?') > -1) communityNo = communityNo.slice(0,communityNo.lastIndexOf('?')); // ?以降を削除
		log('communityNo:' + communityNo);
		
		// 掲示板を別ウィンドウで開くように書き換え
		try{
			var bbsLink = $('a[href="/bbs/'+communityNo+'?com_header=1"]');
			$(bbsLink).prop("href","http://dic.nicovideo.jp/b/c/" + communityNo +"/");
			$(bbsLink).prop("target","_blank");
			bbsLink = $('a[href="/bbs/'+communityNo+'?side_bar=1"]');
			$(bbsLink).prop("href","http://dic.nicovideo.jp/b/c/" + communityNo +"/");
			$(bbsLink).prop("target","_blank");
		}catch(e){
			log(e);
		}
		
		return;
	}else{
		// コミュニティ番号を取得
		communityNo = locationUrl.slice(locationUrl.indexOf('/co')+1,locationUrl.lastIndexOf('/'));
		log('communityNo:' + communityNo);
	
	}
	
	// しおりがある場合リダイレクト
	if(null != ls.getItem('bookmarkResNo@' + communityNo)){
		resNum = Number(ls.getItem('bookmarkResNo@' + communityNo));
		var baseResNum = resNum - ((resNum-1) % 30);
		var url = locationBaseUrl + baseResNum + '-#' + resNum;
		// しおりは使い捨て
		ls.removeItem('bookmarkResNo@' + communityNo);
		$(location).attr('href',url);
	}
			
	try{
		initPage();
	}catch(e){
		viewError(e);
		return;
	}
	
	// 邪魔なページャーを削除
	$('.pager').empty();
	
	// 前を取得リンクを生成
	var topPagerPrev = $('.pager:first');
	$(topPagerPrev).append('<a href="" id="naviPrev" class="navigate">≪ 前を取得</a>');
	// スクロールが一番上に来たら前のレスを取得
	$(window).scroll(function () {
		if(0 == $(this).scrollTop()){
			if(!$('#naviPrev').prop("disabled")){
				if(!$('#oekakiOnly').prop("checked")){
					getNewRes(false);
				}else{
					tempResNum = 0;
					tempOekakiNum = 0;
					getNewOekakiRes(false);
				}
			}
		}
	});
	
	// 続きを取得リンクを生成
	var bottomPagerNext = $('.pager:last');
	$(bottomPagerNext).append('<a href="" id="naviNext" class="navigate">続きを取得 ≫</a>');
	
	// 最新まで取得リンクを生成
	$(bottomPagerNext).append('&nbsp;&nbsp;&nbsp;<a href="" id="naviNextNew" class="navigate">最新まで取得 ≫≫</a>');
	
	// 受信結果を一時的に受けるdivを生成（非表示）
	$(bottomPagerNext).before('<div id="tempResult" style="display:none"></div>');
	
	// 以前描画領域を生成
	$(topPagerPrev).after('<div id="prevResult"></div>');
	
	// お絵かき受信結果を一時的に受けるdivを生成（非表示）
	$(topPagerPrev).after('<div id="tempOekakiResult" style="display:none"></div>');
	
	// 前を取得が押された時のイベント
	$('#naviPrev').click(function(){
		if(!$('.navigate').prop("disabled")){
			if(!$('#oekakiOnly').prop("checked")){
				getNewRes(false);
			}else{
				tempResNum = 0;
				tempOekakiNum = 0;
				getNewOekakiRes(false);
			}
		}
		
		return false;
	});
	
	var forms = $('form');
	// 管理者権限の場合
	if(null != forms[1]){
		// 続き描画領域を生成
		$('form>input').before('<div id="nextResult"></div>');
	}else{
		// 続き描画領域を生成
		$(bottomPagerNext).before('<div id="nextResult"></div>');
	}
	
	// 続きを取得が押された時のイベント
	$('#naviNext').click(function(){
		if(!$('.navigate').prop("disabled")){
			if(!$('#oekakiOnly').prop("checked")){
				getNewRes(true);
			}else{
				tempResNum = 0;
				tempOekakiNum = 0;
				getNewOekakiRes(true);
			}
		}
		
		return false;
	});
	
	// 最新まで取得が押された時のイベント
	$('#naviNextNew').click(function(){
		if(!$('.navigate').prop("disabled")){
			tempResNum = 0;
			tempOekakiNum = 0;
			loadEnd = false;
			scrollFlag = true;
			var oekaki = $('#oekakiOnly').prop("checked");
			var msg = oekaki ? 'お絵かき' : 'レス';
			
			try{
				loading(true);
				var getResTimer = setInterval(function(){
					try{
						if(!loading1 && !loading2){
							if(loadEnd){
								clearInterval(getResTimer);
								loading(false);
								if(!oekaki){
									if(0 < tempResNum){
										showMsg('取得レス数：' + tempResNum + '件');
									}else if(0 == tempResNum){
										showMsg('新しいレスはありません。');
									}
								}else{
									if(0 < tempOekakiNum){
										showMsg('取得お絵かき数：' + tempOekakiNum + '件');
									}else if(0 == tempOekakiNum){
										showMsg('新しいお絵かきはありません。');
									}
								}
							}else{
								if(!oekaki){
									getNewRes(true, true);
								}else{
									getNewOekakiRes(true, true);
								}
							}
						}
						
						if(300 <= tempResNum){
							clearInterval(getResTimer);
							loading(false);
							loadEnd = true;
							if(!oekaki){
								showMsg('取得レス数：' + tempResNum + '件（取得レス数が多すぎるため、処理を中断しました。）',8000);
							}else{
								showMsg('取得お絵かき数：' + tempOekakiNum + '件（取得レス数が多すぎるため、処理を中断しました。）',8000);
							}
						}
					}catch(e){
						loadEnd = true;
						loading(false);
					}
				},300);
			}catch(e){
				clearInterval(getResTimer);
				loading(false);
			}
		}
		
		return false;
	});
	
	// 書き込みボタン押下時イベント
	$('.button-m:first').click(function(){
		if(post) {
			log('not post');
			return false;
		}
		
		// 複数起動チェック
		if(1 < $("[name='msgDiv']").length){
			var msg = 'ねもうす channel viewerが複数動作しているため、投稿を中止しました。拡張機能をご確認ください。';
			$('#impMsgDiv').css({height: '20px'});
			$('#impMsgDiv').html('<div class="msgDiv">' + msg + '</div>');
			
			return false;
		}
		
		try{
			var from = $('#res_from').val().trim();
			var message = $('#res_message').val().trim();
			
			if("" == message){
				showMsg('本文がありません。');
				return false;
			}else{
				post = true;
				$('#res_message').val("");
				
				$.ajax({
					type: 'post',
					data: {"FROM": from , "MESSAGE": message, "magic": "dummy"}, 
					url: 'http://dic.nicovideo.jp/b/c/' + communityNo + '/p',
					success: function(data){
						if(-1 < data.indexOf('投稿間隔が短すぎです')){
							viewError('投稿間隔が短すぎです。300秒待ってください。');
							$('#res_message').val(message);
  						}else if(-1 < data.indexOf('投稿内容が長すぎです')){
							viewError('投稿内容が長すぎです。1024文字に収めてください。');
							$('#res_message').val(message);
  						}else if(-1 < data.indexOf('投稿内容に長すぎる行があります')){
							viewError('投稿内容に長すぎる行があります。1行は192文字に収めてください。');
							$('#res_message').val(message);
						}else if("DIV" == $('form.resform').prev().prop("tagName")){
							viewError($('form.resform').prev().text().trim());
							$('#res_message').val(message);
						}else if(-1 < data.indexOf('投稿を受け付けました')){
							showMsg('投稿を受け付けました。');
							//$('#res_from').val("");
							//$('#res_message').val("");
							getNewRes(true);
						}else{
							log('data:'+data);
							viewError('投稿に失敗しました。');
							$('#res_message').val(message);
						}
						setTimeout(function(){
							post = false;
						},5000);
					},
					error: function(xhr, textStatus, error){
						log(xhr.statusText);
						log(textStatus);
						log(error);
						viewError('投稿に失敗しました。(status：' + xhr.status + ' ' + xhr.statusText + ')');
						$('#res_message').val(message);
						post = false;
					}
				});
			}
		}catch(e){
			viewError(e);
			$('#res_message').val(message);
			post = false;
		}
		
		return false;
	});
	
	// 本文へのURLドロップ時イベント
	$('#res_message').on("drop", function(e){
		var dropUrl = e.originalEvent.dataTransfer.getData("Text");
		var drop = dropUrl.match(/sm\d+|co\d+|lv\d+/);
		
		if(null != drop){
			drop = ">>" + drop + "\n";
			var s = $('#res_message').val();
			var p = $('#res_message').get(0).selectionStart;
			var np = p + drop.length;
			$('#res_message').val(s.substr(0, p) + drop + s.substr(p));
			$('#res_message').get(0).setSelectionRange(np, np);
			$('#res_message').get(0).focus();
			log(e.originalEvent.dataTransfer.getData("Text"));
		}
		
		return false;
    });
    
    $("#res_message").on("dragover",function(e){
    	e.stopPropagation();
		e.preventDefault();
	});


	// 前を取得時のスクロール位置調整値を取得
	prevResAdjustTop = -$('.reshead:first').offset().top;
	
	// 削除掲示板へのリンクを削除
	$('#post-form').next().css({height:'5px'});
	$('#post-form').next().empty();

	// 複数起動チェック
	setTimeout(function(){
		if(1 < $("[name='msgDiv']").length){
			var msg = 'ねもうす channel viewerが複数動作しています、拡張機能をご確認ください。';
			$('#impMsgDiv').css({height: '20px'});
			$('#impMsgDiv').html('<div class="msgDiv">' + msg + '</div>');
		}
	},2000);
})

function initPage(){
	$('body').css('margin-left',"10px");
	$('body').css('margin-top',"30px");
	$('body').css('margin-bottom',"30px");
	
	// ロード中表示領域を生成
	$('body').append('<div id="natsunoDiv" name="natsunoDiv" '
					+'style="overflow: hidden; display:none; position:fixed; top:0px; right: 0px; '
					+'height:150px; width:150px; z-index: 15;"/>')
	
	// メッセージ用領域を生成
	$('body').append('<div id="msgDiv" name="msgDiv" '
					+'style="overflow: hidden; z-index: 10; position:fixed; top:0px; left:0px; background-color:#ffdd89; '
					+'height:0px; width:100%;"/>');
					
	// 重要メッセージ用領域を生成
	$('body').append('<div id="impMsgDiv" name="impMsgDiv" '
					+'style="overflow: hidden; z-index: 10; position:fixed; top:0px; left:0px; background-color:#ff7563; '
					+'height:0px; width:100%;"/>');
	
	// 設定用領域を生成
	$('body').append('<div id="settingDiv" name="settingDiv" class="settingDiv" '
					+'style="min-width: 750px; overflow: hidden; z-index: 10; position:fixed; bottom:0; left:0px; background-color:#000000; '
					+'height:25px; width:100%;"/>');
	$('#settingDiv').append('<input type="checkbox" id="autoReload" name="autoReload">&nbsp;<label for="autoReload">オートリロード</label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')
					.append('リロード間隔&nbsp;<input type="range" id="reloadInterval" step="5" value="30" min="10" max="300" style="height:11px; width:100px;" />')
					.append('&nbsp;<span id="autoReloadInterval">30</span>&nbsp;sec&nbsp;&nbsp;&nbsp;&nbsp;')
					.append('<input type="checkbox" id="autoScroll" name="autoScroll">&nbsp;<label for="autoScroll">オートスクロール</label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')
					.append('<input type="checkbox" id="eco" name="eco">&nbsp;<label for="eco">エコモード</label>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')
					.append('<div id="settingInnerDiv" style="vertical-align:middle; padding-bottom:2px; display: inline-block;">')
					.append('<div id="settingInnerDiv2" style="margin-top:4px;">')
					.append('</div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
	$('#settingInnerDiv').append('<img id="save" title="設定を保存" style="cursor: pointer;" src="'+chrome.extension.getURL("images/save.png") + '"/>&nbsp;&nbsp;')
						 .append('<img id="default" title="デフォルト設定に戻す" style="cursor: pointer;" src="'+chrome.extension.getURL("images/default.png") + '"/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')
						 .append('<span id="more" title="その他の機能" class="moreHide" style="font-size:22px; font-weight:bold; cursor: pointer;">…</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');

	$('#settingInnerDiv2').append('レスNo：&nbsp;<input type="number" id="jumpResNum" maxlength="10" style="width:90px;ime-mode:disabled;"/>&nbsp;&nbsp;')
						  .append('<input type="button" id="jumpButton" value="ジャンプ" style="height:24px;" />&nbsp;&nbsp;&nbsp;&nbsp;')
						  .append('<input type="button" id="resDisplaySettingButton" value="レス表示設定" style="height:24px;" />');

	//$('body').append('<div id="modal-overlay"></div>');
	$('body').append('<div id="resDisplaySettingDiv" class="resDisplaySettingDiv"' +
					'style="font-size:12px; font-weight:bold; height:450px; width: 350px; z-index: 20; position:fixed;' +
					'border-radius: 4px; box-shadow:5px 5px; padding:15px; background-color:#ffffff; overflow:auto; display:none;"' +
					'/>');
	$('#resDisplaySettingDiv').append('NGワード&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<input type="checkbox" id="transparent" name="transparent">&nbsp;<label for="transparent">透明NG</label><br>');
	$('#resDisplaySettingDiv').append('<textarea id="ngWord"cols="50" rows="10" style="height:50px; width: 330px;"/><br><br>');
	$('#resDisplaySettingDiv').append('NGID<br><textarea id="ngId" cols="50" rows="10" style="height:50px; width: 330px;"/><br><br>');
	$('#resDisplaySettingDiv').append('ハイライトワード<br><textarea id="highlightWord" cols="50" rows="10" style="height:50px; width: 330px;"/><br><br>');
	$('#resDisplaySettingDiv').append('ハイライトID<br><textarea id="highlightId" cols="50" rows="10" style="height:50px; width: 330px;"/><br><br>');
	$('#resDisplaySettingDiv').append('<input type="button" id="ngClear" value="NG設定をクリア"/>&nbsp;&nbsp;<input type="button" id="highlightClear" value="ハイライト設定をクリア"/><br><br>');
	$('#resDisplaySettingDiv').append('<input type="checkbox" id="oekakiOnly" name="oekakiOnly">&nbsp;<label for="oekakiOnly">お絵かきのみ表示</label><br>');
//	$('#resDisplaySettingDiv').append('<input type="checkbox" id="oekakiLately" name="oekakiLately">&nbsp;<label for="oekakiLately">最近のお絵かきを表示</label><br>');
	$('#resDisplaySettingDiv').append('<input type="checkbox" id="thumbnailOuterVideo" name="thumbnailOuterVideo" checked="checked">&nbsp;<label for="thumbnailOuterVideo">Youtube動画をサムネイル表示</label><br>');
	$('#resDisplaySettingDiv').append('<input type="checkbox" id="thumbnailPicture" name="thumbnailPicture" checked="checked">&nbsp;<label for="thumbnailPicture">画像をサムネイル表示</label><br>');

/*
	$('body').append('<div id="latelyOekakiDiv" class="displayOekakiDiv"' +
					'style="font-size:12px; font-weight:bold; height:40%; width: 30%; min-width: 200px; z-index: 5; position:fixed;' +
					'top:0; right:0; margin-top:20px; padding:15px; background-color:#ffffff; overflow:auto; display:none;"' +
					'/>');
	
	$('#latelyOekakiDiv').append('<p style="text-align:center; padding-bottom:5px;">最近のお絵かき</p>');
	$('#latelyOekakiDiv').append('<p id="oeTitle" style="text-align:center; padding-bottom:5px;"></p>');
	$('#latelyOekakiDiv').append('' +
								  '<div id="divNewOekaki" style="text-align:center; height:60%; width:auto;">' +
								  '<img id="newOekaki" class="newOekaki" src="'+chrome.extension.getURL("images/blank.png") + '" style="width:auto;height:100%;">' +
								  '</div>' +
								  '<div id="thumbnailOekakiDiv" style="margin-top:20px; text-align:center; height:15%; width:auto;">' +
								  '		<div id="thumbnailOekakiDiv5" style="text-align:center; display:inline; height:auto; width:20%;">' +
								  '			<img id="thumbnailOekaki5"width:auto;height:100%; class="thumbnailOekaki" src="'+chrome.extension.getURL("images/blank.png") + '" style="width:auto;height:100%;" ' +
								  '			onclick="">' +
								  '		</div>' +
								  '		<div id="thumbnailOekakiDiv4" style="text-align:center; display:inline; height:auto; width:20%;">' +
								  '			<img id="thumbnailOekaki4"width:auto;height:100%; class="thumbnailOekaki" src="'+chrome.extension.getURL("images/blank.png") + '" style="width:auto;height:100%;" ' +
								  '			onclick="">' +
								  '		</div>' +
								  '		<div id="thumbnailOekakiDiv3" style="text-align:center; display:inline; height:auto; width:20%;">' +
								  '			<img id="thumbnailOekaki3"width:auto;height:100%; class="thumbnailOekaki" src="'+chrome.extension.getURL("images/blank.png") + '" style="width:auto;height:100%;" ' +
								  '			onclick="">' +
								  '		</div>' +
								  '		<div id="thumbnailOekakiDiv2" style="text-align:center; display:inline; height:auto; width:20%;">' +
								  '			<img id="thumbnailOekaki2"width:auto;height:100%; class="thumbnailOekaki" src="'+chrome.extension.getURL("images/blank.png") + '" style="width:auto;height:100%;" ' +
								  '			onclick="">' +
								  '		</div>' +
								  '		<div id="thumbnailOekakiDiv1" style="text-align:center; display:inline; height:auto; width:20%;">' +
								  '			<img id="thumbnailOekaki1"width:auto;height:100%; class="thumbnailOekaki" src="'+chrome.extension.getURL("images/blank.png") + '" style="width:auto;height:100%;" ' +
								  '			onclick="">' +
								  '		</div>' +
								  '</div>' +
								  '');

*/



	// 設定divアニメーション
	$('#more').click(function(){
		if($('#more').hasClass('moreHide')){
			$('#settingDiv').animate({
		        height: '60px'
		    });
		    $('#more').removeClass();
		    $('#more').addClass('moreShow');
		}else{
			$('#settingDiv').animate({
		        height: '25px'
		    });
		    $('#more').removeClass();
		    $('#more').addClass('moreHide');
		}
	});
    

	// 設定各種イベント
	$('#autoReload').click(function(){
		setAutoReload();
	});
	$('#reloadInterval').on('input', function () {
		$('#autoReloadInterval').text($('#reloadInterval').val());
	} );
	$('#reloadInterval').change(function(){
		setAutoReload();
	});
	$('#save').click(function(){
		log('checked : '+$('#autoReload').prop('checked'));
		ls.setItem('autoReload', $('#autoReload').prop('checked'));
		ls.setItem('autoReloadInterval', $('#reloadInterval').val());
		ls.setItem('autoScroll', $('#autoScroll').prop('checked'));
		ls.setItem('eco', $('#eco').prop('checked'));
		setAutoReload();
		showMsg('設定を保存しました。');
	});
	$('#default').click(function(){
		//ls.clear();
		$('#autoReload').prop('checked','');
		$('#reloadInterval').val('30');
		$('#autoScroll').prop('checked','');
		$('#eco').prop('checked','');
		setAutoReload();
		showMsg('設定をデフォルトに戻しました。');
	});
	// ジャンプレスNoのmaxlength処理
	$('#jumpResNum').on('input', function () {
		if ($(this).val().length > $(this).attr('maxlength'))
		$(this).val($(this).val().slice(0, $(this).attr('maxlength')));
	});
	// ジャンプボタン
	$('#jumpButton').click(function(){
		var resNum = $('#jumpResNum').val();
		if("" == resNum){
			viewError('レスNoを入力してください。');
		}else if(0 >= resNum){
			viewError('1以上の数値を入力してください。');
		}else{
			resNum = Number(resNum);
			//var baseResNum = Number(resNum) - (Number(resNum) % 30) + 1;
			var baseResNum = resNum - ((resNum-1) % 30);
			var url = locationBaseUrl + baseResNum + '-#' + resNum;
			window.open(url, '_blank');
		}
	});
	// NG設定ボタン
	$('#resDisplaySettingButton').click(function(){
		$(this).blur() ;	//ボタンからフォーカスを外す
		if($("#modal-overlay")[0]){
			$("#modal-overlay").remove();
			$('#resDisplaySettingDiv').hide();
			applyDisplaySetting();
			return false;
		}
		
		$("body").append('<div id="modal-overlay"></div>');
		
		$("#modal-overlay").show();
		var w = $(window).width();
		var h = $(window).height();
		var pxleft = ((w - 350)/2);
		var pxtop = ((h - 450)/2);
		$("#resDisplaySettingDiv").css({"left": pxleft + "px"});
		$("#resDisplaySettingDiv").css({"top": pxtop + "px"});
		$("#modal-overlay").click(function(){
			$("#modal-overlay").remove();
			$('#resDisplaySettingDiv').hide();
			applyDisplaySetting();
		});
		
		$('#resDisplaySettingDiv').show();
	});
	
	// レス表示設定エリアイベント設定
	$('#ngWord').on('input',function(){
		ls.setItem('ngWord', $('#ngWord').val());
	});
	$('#ngId').on('input',function(){
		ls.setItem('ngId', $('#ngId').val());
	});
	$('#highlightWord').on('input',function(){
		ls.setItem('highlightWord', $('#highlightWord').val());
	});
	$('#highlightId').on('input',function(){
		ls.setItem('highlightId', $('#highlightId').val());
	});
	$('#transparent').click(function(){
		ls.setItem('transparent', $('#transparent').prop('checked'));
	});
	$('#ngClear').click(function(){
		$('#ngWord').val('');
		$('#ngId').val('');
		ls.setItem('ngWord', $('#ngWord').val());
		ls.setItem('ngId', $('#ngId').val());
	});
	$('#highlightClear').click(function(){
		$('#highlightWord').val('');
		$('#highlightId').val('');
		ls.setItem('highlightWord', $('#highlightWord').val());
		ls.setItem('highlightId', $('#highlightId').val());
	});
	
	$('#oekakiOnly').click(function(){
		ls.setItem('oekakiOnly', $('#oekakiOnly').prop('checked'));
		
		if($('#oekakiOnly').prop('checked')){
			$('#oekakiLately').prop('checked','');
			ls.setItem('oekakiLately', '');
		}
	});
	
	$('#oekakiLately').click(function(){
		ls.setItem('oekakiLately', $('#oekakiLately').prop('checked'));
		
		if($('#oekakiLately').prop('checked')){
			$('#oekakiOnly').prop('checked','');
			ls.setItem('oekakiOnly', '');
		}
	});
	
	$('#thumbnailOuterVideo').click(function(){
		ls.setItem('thumbnailOuterVideo', $('#thumbnailOuterVideo').prop('checked'));
	});
	
	$('#thumbnailPicture').click(function(){
		ls.setItem('thumbnailPicture', $('#thumbnailPicture').prop('checked'));
	});
	
	
	// 広告を削除
	$('#aswift_0_expand').remove();
	$('#aswift_1_expand').remove();
	$('#aswift_2_expand').remove();
	$('#sub-frame-error').remove();
	$('#google_ads_div_ncom_ft01_rect_ad_wrapper').remove();
	$('#imobile_adspotdiv1').remove();
	
	
	// 邪魔な説明を折りたたみ
	$('#post-form>ul').before('<a href="" id="descriptionToggle">▲</span>');
	$('#post-form>ul').hide()
	$('#descriptionToggle').click(function(){
		$('#post-form>ul').toggle();
		if("block" == $('#post-form>ul').css('display')){
			$('#descriptionToggle').html('▼'); // open
		}else{
			$('#descriptionToggle').html('▲'); // close
		}
		
		return false;
	});
	
	
	$('body').append('<iframe id="postFormFrame" name="postFormFrame" style="display:none"/>');
	$('.resform').prop("target","postFormFrame");
	
	// セッション修復用フレーム
	$('body').append('<iframe id="reacquisitionSessionFrame" src="http://com.nicovideo.jp/community/'  + communityNo + '/" style="display:none"/>');
	
	$(".reshead").addClass("resheadNew");
	
	// 設定情報の読み込み
	log('getItem : '+ls.getItem('autoReload'));
	$('#autoReload').prop('checked',eval(ls.getItem('autoReload')));
	var interval = ls.getItem('autoReloadInterval');
	interval = interval == null ? 30 : interval;
	$('#reloadInterval').val(Number(interval));
	$('#autoScroll').prop('checked',eval(ls.getItem('autoScroll')));
	$('#eco').prop('checked',eval(ls.getItem('eco')));
	$('#ngWord').val(ls.getItem('ngWord'));
	$('#ngId').val(ls.getItem('ngId'));
	$('#highlightWord').val(ls.getItem('highlightWord'));
	$('#highlightId').val(ls.getItem('highlightId'));
	$('#transparent').prop('checked',eval(ls.getItem('transparent')));
	$('#oekakiOnly').prop('checked',eval(ls.getItem('oekakiOnly')));
	$('#oekakiLately').prop('checked',eval(ls.getItem('oekakiLately')));
	if(null != ls.getItem('thumbnailOuterVideo')) $('#thumbnailOuterVideo').prop('checked',eval(ls.getItem('thumbnailOuterVideo')));
	if(null != ls.getItem('thumbnailPicture')) $('#thumbnailPicture').prop('checked',eval(ls.getItem('thumbnailPicture')));
	setAutoReload();
	
	// 初期化イベント
	initEvent();
	
}

// お絵かきのみ表示処理
function showOekaki(){
	if($('#oekakiOnly').prop('checked')){
		//$('dl:has(div[id^=oekaki])').show();
		$('dd:has(div[id^=oekaki])').show();
		$('dd:has(div[id^=oekaki])').prev().show();
		//$('dl:not(:has(div[id^=oekaki]))').hide();
		$('dd:not(:has(div[id^=oekaki]))').hide();
		$('dd:not(:has(div[id^=oekaki]))').prev().hide();
	}else{
		$('dl').show();
	}
}


// youtube動画サムネイル表示処理
function showOuterVideo(){
	if(!$('#thumbnailOuterVideo').prop('checked')){
		return;
	}
	
	// youtube
	var youtubeLink = $("a[href^=https\\:\\/\\/www\\.youtube\\.com\\/watch\\?v\\=],a[href^=https\\:\\/\\/youtu\\.be\\/]")
						.not('#tempOekakiResult a');
	$(youtubeLink).each(function(){
		//$(this).addClass('thumbnailYoutube');
		var ytlink = $(this);
		
		var videoId = "";
		var match = $(this).prop("href").match(/https:\/\/www.youtube.com\/watch\?v\=([0-9a-zA-Z_+-]*)\??&?/);
		if(null != match){
			videoId = match[1];
		}else{
			match = $(this).prop("href").match(/https:\/\/youtu.be\/([0-9a-zA-Z_+-]*)\??&?/);
			if(null != match){
				videoId = match[1];
			}
		}
		var resNum = $(this).parent().prev().find('a:first').prop("name");
		if(undefined == resNum) return;
		
		// Youtubeリンクに対するiframeが未作成なら作成する
		if(0 == $(this).parent().find('.ytif_' + (resNum) + '_' + (videoId) + ':not(#tempOekakiResult iframe)').length){
			$(this).after('<br><iframe id="ytif_' + resNum + '_' + videoId + '" class="nicovideo ytif_' + resNum + '_' + videoId + '" frameborder="0" scrolling="no" style="height:176px;width:340px;"></iframe>');
			$('#ytif_' + resNum + '_' + videoId).hide();
		}
		
		log('ytif:' + $('.ytif_' + (resNum) + '_' + (videoId) + ':not(#tempOekakiResult iframe)').length);
		
		// バルーン表示すると同じclass名のiframeウィンドウができるのでeachで回して全てに対して処理する
		$('.ytif_' + (resNum) + '_' + (videoId) + ':not(#tempOekakiResult iframe)').each(function(){
			var ifrm = this;
			var doc = ifrm.contentWindow.document;
			log(ifrm);
			
			if(null == ifrm.contentWindow) return;
			
			// iframe内がまだロードされていなければロード実行
			if(0 == $('table',doc).length){
				log('exec youtube api');
		
				$.getJSON("http://unkochan.netgamers.jp/getYoutubeInfo.php?videoId=" + videoId
					,function(data, status){
					})
					.done(function(data) {
					    log("成功");
						// 再生時間の取得と整形
						var playTime = data.playTime;
						var playTimeFormat = playTime.split("PT")[1].replace("H",":").replace("M",":").replace("S","");
							playTimeFormat = playTimeFormat.split(":")[0] + ':'
											 + ('0' + playTimeFormat.split(":")[1]).slice(-2)
											 + (2 < playTimeFormat.split(":").length ? ':' + ('0' + playTimeFormat.split(":")[2]).slice(-2) : '');
						// 投稿時間の取得と整形
						var publishedAt = new Date(Date.parse(data.publishedAt));
						publishedAt.setHours(publishedAt.getHours() + 9); //localtime
						var publishedAtFormat = publishedAt.getFullYear().toString().slice(2) + '/'
										+ ('0' + (publishedAt.getMonth() + 1)).slice(-2) + '/'
										+ ('0' + publishedAt.getDate()).slice(-2)
										+ ' '
										+ ('0' + publishedAt.getHours()).slice(-2) + ':'
										+ ('0' + publishedAt.getMinutes()).slice(-2);
						
						var now = (new Date()).getTime();
						
						// iframeの中身を生成
						log(doc);
						$('body',doc).append(
									  '<html><head>'
									+ '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">'
									+ '<meta http-equiv="Content-Script-Type" content="text/javascript">'
									+ '<meta http-equiv="Content-Style-Type" content="text/css">'
									+ '<meta name="copyright" content="© DWANGO Co., Ltd.">'
									+ '<title>' + data.title +'</title>'
									+ '<base href="http://www.nicovideo.jp/thumb/">'
									+ '<link rel="stylesheet" type="text/css" href="http://res.nimg.jp/css/thumb/nico/common.css">'
									+ '</head>'
									+ '<body>'
									+ '<table border="0" cellpadding="2" cellspacing="0" style="margin-bottom:4px;">'
									+ '<tbody><tr>'
									+ '<td><img src="' + chrome.extension.getURL("images/youtube.png") + '" alt="Youtube"></td>'
									+ '<td><img src="http://res.nimg.jp/img/thumb/nico/txt_video.gif" alt="VIDEO"></td>'
									+ '</tr>'
									+ '</tbody></table>'

									+ '<div style="padding:4px;">'

									+ '<p class="TXT10">'
									+ '再生：<strong>' + Number(data.viewCount).toLocaleString() + '</strong>&nbsp;'
									+ 'コメント：<strong>' + (data.commentCount ? Number(data.commentCount).toLocaleString() : '-') + '</strong>&nbsp;'
									+ '<br>'
									+ 'お気に入り：<strong>' + (data.favoriteCount ? Number(data.favoriteCount).toLocaleString() : '-') + '</strong>&nbsp;&nbsp;'
									+ '&#128077;：<strong>' + (data.likeCount ? Number(data.likeCount).toLocaleString() : '-') + '</strong>&nbsp;'
									+ '&#128078;：<strong>' + (data.dislikeCount ? Number(data.dislikeCount).toLocaleString() : '-') + '</strong>'
									+ '</p>'

									+ '<table border="0" cellpadding="0" cellspacing="0" summary="" style="margin-top:2px;">'
									+ '<tbody><tr valign="top">'
									+ '<td>'
									+ '<p><a href="' + $(ytlink).prop("href") + '" target="_blank"><img alt="" src="' + data.thumbnails + '" class="video_img"></a></p>'
									+ '<p class="TXT10" style="margin-top:2px;"><strong>' + playTimeFormat + '</strong></p>'
									+ '</td>'
									+ '<td style="padding-left:4px;">'
									+ '<p class="TXT10">'
									+ '<strong>' + publishedAtFormat + '</strong> 投稿'
									+ '</p>'
									+ '<p class="TXT12"><a href="' + $(ytlink).prop("href") + '" target="_blank" class="video">' + data.title +'</a></p>'
									+ '<p class="TXT10">' + data.description + '</p>'
									+ '</td>'
									+ '</tr>'
									+ '</tbody></table>'
								//	+ '<div class="video_res"></div>'
									+ '</div>'
									+ '</body></html>'
								);
						setTimeout(function(){
							$(ifrm).show();
						},500);
					})
					.fail(function(xhr, textStatus, error) {
						log('error get youtube info');
						log(xhr.statusText);
						log(textStatus);
						log(error);
					})
					.always(function() {
					    log("完了");
					});
			}else{
				$(ifrm).show();
				$(ifrm).prev().show();
			}
		});
		
		
	});
}

// 画像サムネイル表示処理
function showThumbnailPicture(){
	if(!$('#thumbnailPicture').prop('checked')){
		return;
	}
	
	$('.thumbnailPictureLink').prev().show();
	$('.thumbnailPictureLink').show();
	
	var pictureLink = $("a[href*=\\.jpg],a[href*=\\.jpeg],a[href*=\\.png]").not('#tempOekakiResult a').not('.thumbnailPictureTarget,.thumbnailPictureLink');
	$(pictureLink).each(function(){
		$(this).addClass("thumbnailPictureTarget");
		$(this).after('<br><a href="' + $(this).prop("href") + '" target="_blank" class="thumbnailPictureLink">'
					+ '<img src="' + $(this).prop("href") + '" class="thumbnailPicture" style="height:100px;width:auto;">'
					+ '</a>');
		
	});
	
	// gifの場合、giffferライブラリを使って一時停止状態で表示する
	pictureLink = $("a[href*=\\.gif]").not('#tempOekakiResult a').not('.thumbnailPictureTarget,.thumbnailPictureLink');
	$(pictureLink).each(function(){
		$(this).addClass("thumbnailPictureTarget");
		$(this).after('<br><img data-gifffer="' + $(this).prop("href") + '" class="thumbnailPicture" style="height:100px;width:auto;"></a>');
		
	});
	
}

/* バルーン表示関連 */
var array = [];
setInterval(function(){
	if(0 == $('div[class^=balloon]:visible').length){
		array = [];
	}
},3000);
function setBallonResAnchor(target){
	$(target).each(function(){
		//	$(this).prop('id','anchor'+$(this).prop("href").split("#")[1]);
		var targetRes = getResAnchorDisplay($(this));
		var html = 'レス情報取得中...';
		if(null != targetRes){
			html = $(targetRes).html();
		}else{
			// 表示中に無ければロードフラグを立てておく
			$(this).prop('needLoad',true);
		}
		
		// 安価にマウスが入った場合のイベント設定
		$(this).unbind('mouseenter');
		$(this).mouseenter(function(){
		log('mouseenter');
			// 読み込みが必要なら取得
			if($(this).prop('needLoad')){
				getResAnchor($(this));
			}
			
			// 非同期でバルーン設定を再帰呼び出し（バルーン内の安価のバルーンを設定）
			setTimeout(function(){
				setBallonResAnchor($("div>.dic"));
			},0);
			
			setMouseenterBalloonEvent($(this),html);
		});
		
		// 安価リンクからマウスが出たらバルーンを消す
		$(this).mouseleave(function(){
			$(this).data("options").minLifetime = 300;
			$(this).hideBalloon();
		});
	
	});
}

// レスIDのバルーン表示設定
function setBallonResId(target){
	// 安価にマウスが入った場合のイベント設定
	$(target).unbind('mouseenter');
	$(target).mouseenter(function(){
	log('mouseenter');
		var resId = $(this).prop('id').split('id')[1];
		var resArray = resIdArray[resId];
		
		resArray.sort(function(a,b){
			if(a.resNum < b.resNum) return -1;
			if(a.resNum > b.resNum) return 1;
			return 0;
		});
		
		var html = "";
		for(var i in resIdArray[resId]){
			if("" != html) html += '<br><br>';
			var res = resIdArray[resId][i];
			html += '<i>' + res.resHead.text() + '</i><br>' + res.resData.html();
		}
		
		// 非同期でバルーン設定を呼び出し（バルーン内の安価のバルーンを設定）
		setTimeout(function(){
			setBallonResAnchor($("div>.dic"));
		},0);
		
		setMouseenterBalloonEvent($(this),html);
		
		$('div>.ngRes').click(function(){
			return false;
		});
		$('div>.ngRes').mouseenter(function(){
			setTimeout(function(){
				setBallonResAnchor($("div>.dic"));
			},0);
			setMouseenterBalloonEvent($(this),$(this).prev().html());
		});
		// 安価リンクからマウスが出たらバルーンを消す
		$('div>.ngRes').mouseleave(function(){
			$(this).data("options").minLifetime = 300;
			$(this).hideBalloon();
		});
	});
	
	// 安価リンクからマウスが出たらバルーンを消す
	$(target).mouseleave(function(){
		$(this).data("options").minLifetime = 300;
		$(this).hideBalloon();
	});
}

function setMouseenterBalloonEvent(balloonTarget,html){
	//var balloonTarget = $(this);
	try{
		// 表示バルーンがあれば擬似的に永続表示するよう設定を上書き
		$(balloonTarget).data("options").minLifetime = 99999999;
		$(balloonTarget).hideBalloon();
	}catch(e){
	}
	
	// バルーン表示
	var balloonClassName = "balloon"+(new Date()).getTime();
	$(balloonTarget).showBalloon({classname: balloonClassName, html: true, position: "right",
								 minLifetime: 99999999, showDuration: 0, hideDuration: 0, contents: html,
								// バルーンを閉じた時は対象安価配列から削除
								hideComplete: function(){
									array.some(function(v, i){
										if ($(v.balloon).prop("class")==this.classname) array.splice(i,1);
									});
								},
								css: {
									fontSize: "12px",
									border: "1px solid rgba(212, 212, 212, .4)",
									boxShadow: "2px 2px 4px #555",
									color: "#000",
									backgroundColor: "#fffbdd",
									opacity: "1"
								}
	});
	
	// バルーンを設定した安価とバルーンのオブジェクトを配列に登録
	array.push({target:balloonTarget, balloon:balloonTarget.data().balloon});
	
	// バルーンにマウスが入ったら、表示中の全てのバルーンを永続表示
	// （バルーンから表示したバルーンに入った場合に、前のバルーンを消さないため）
	balloonTarget.data().balloon.on("mouseenter", function() {
								for(var i in array){
									try{
										array[i].target.data("options").minLifetime = 99999999;
										array[i].target.showBalloon().hideBalloon();
										//array[i].hideBalloon();
									}catch(e){
										array.splice(i,1);
									}
								}
							});
	// バルーンからマウスが出たら、表示中の全てのバルーンを指定ディレイ後に消す
	balloonTarget.data().balloon.on("mouseleave", function() {
								for(var i in array){
									try{
										array[i].target.data("options").minLifetime = 300;
										array[i].target.hideBalloon();
									}catch(e){
										array.splice(i,1);
									}
								}
							});
	// レス表示設定適用
	//applyDisplaySetting($('.'+balloonClassName));
	log('Youtubeサムネイル表示 st '+(new Date()).getTime());
	showOuterVideo();
	log('Youtubeサムネイル表示 ed '+(new Date()).getTime());
	log('画像サムネイル表示 st '+(new Date()).getTime());
	showThumbnailPicture();
	log('画像サムネイル表示 ed '+(new Date()).getTime());
}

// 初期化イベント
function initEvent(){
	log('auat: ' + $('.auto').length);
	log('auat-hdn: ' + $('.auto-hdn').length);
	// 大百科のリンクを削除
	log('大百科のリンクを削除 st '+(new Date()).getTime());
	$('.auto').contents().unwrap();
	$('.auto-hdn').contents().unwrap();
	log('大百科のリンクを削除 ed '+(new Date()).getTime());

	// レス安価ポップアップ表示設定
	log('レス安価ポップアップ表示設定 st '+(new Date()).getTime());
	setBallonResAnchor($(".dic"));
	$('body').unbind('click');
	$('body').click(function(){
		$('div[class^=balloon]:visible').hide();
	});
	log('レス安価ポップアップ表示設定 ed '+(new Date()).getTime());
	
	// レス番号リンク設定
	log('レス番号リンク設定 st '+(new Date()).getTime());
	$(".resheadNew").each(function(){
		var resHtml = $(this).html();
		var resNum = $(this).text().trim().slice(0,($(this).text().trim().indexOf('：')-1));
		//log('resNum:' + resNum);
		var splitIndex = resHtml.indexOf('：');
		resHtml = insertStr(resHtml, resHtml.indexOf('</a>')+4, '<a href="" id="res' + resNum + '" class="resLink">');
		resHtml = insertStr(resHtml, resHtml.indexOf('：')-1, '</a>');
		//log('resHtml:'+resHtml);
		
		$(this).html(resHtml);
	});
	log('レス番号リンク設定 ed '+(new Date()).getTime());
	
	// レス番メニューの生成
	$.contextMenu({
		selector: '.resLink:not(.resLinkNg,.resLinkHighlight)', 
		trigger: 'left',
		className: 'contextmenu',
		build: function($trigger, e) {
			return {
				callback: contextMenuCallback,
				items: {
					"res": {name: "このレスにレス" ,className:"context-menu-separator-bottom"},
		//			"idMemo": {name: "このIDのメモを書く" ,className:"context-menu-separator-top"},
					"ng": {name: "NGIDに追加" ,className:"context-menu-separator-top"},
					"highlight": {name: "ハイライトIDに追加"},
					"ngWord": {name: "選択文字列をNGワードに追加"},
					"highlightWord": {name: "選択文字列をハイライトワードに追加" ,className:"context-menu-separator-bottom"},
					"bookmark": {name: "しおりを挟む" ,className:"context-menu-separator-top"}
				}
			};
		}
	});
	$.contextMenu({
		selector: '.resLinkNg:not(.resLinkHighlight)', 
		trigger: 'left',
		className: 'contextmenu',
		build: function($trigger, e) {
			return {
				callback: contextMenuCallback,
				items: {
					"res": {name: "このレスにレス" ,className:"context-menu-separator-bottom"},
		//			"idMemo": {name: "このIDのメモを書く" ,className:"context-menu-separator-top"},
					"unng": {name: "このIDのNGを解除" ,className:"context-menu-separator-top"},
					"highlight": {name: "ハイライトIDに追加"},
					"ngWord": {name: "選択文字列をNGワードに追加"},
					"highlightWord": {name: "選択文字列をハイライトワードに追加" ,className:"context-menu-separator-bottom"},
					"bookmark": {name: "しおりを挟む" ,className:"context-menu-separator-top"}
				}
			};
		}
	});
	$.contextMenu({
		selector: '.resLinkHighlight:not(.resLinkNg)', 
		trigger: 'left',
		className: 'contextmenu',
		build: function($trigger, e) {
			return {
				callback: contextMenuCallback,
				items: {
					"res": {name: "このレスにレス" ,className:"context-menu-separator-bottom"},
		//			"idMemo": {name: "このIDのメモを書く" ,className:"context-menu-separator-top"},
					"ng": {name: "NGIDに追加" ,className:"context-menu-separator-top"},
					"unhighlight": {name: "このIDのハイライトを解除"},
					"ngWord": {name: "選択文字列をNGワードに追加"},
					"highlightWord": {name: "選択文字列をハイライトワードに追加" ,className:"context-menu-separator-bottom"},
					"bookmark": {name: "しおりを挟む" ,className:"context-menu-separator-top"}
				}
			};
		}
	});
	$.contextMenu({
		selector: '.resLinkNg.resLinkHighlight', 
		trigger: 'left',
		className: 'contextmenu',
		build: function($trigger, e) {
			return {
				callback: contextMenuCallback,
				items: {
					"res": {name: "このレスにレス" ,className:"context-menu-separator-bottom"},
		//			"idMemo": {name: "このIDのメモを書く" ,className:"context-menu-separator-top"},
					"unng": {name: "このIDのNGを解除" ,className:"context-menu-separator-top"},
					"unhighlight": {name: "このIDのハイライトを解除"},
					"ngWord": {name: "選択文字列をNGワードに追加"},
					"highlightWord": {name: "選択文字列をハイライトワードに追加" ,className:"context-menu-separator-bottom"},
					"bookmark": {name: "しおりを挟む" ,className:"context-menu-separator-top"}
				}
			};
		}
	});
	$.contextMenu({
		selector: '.highlight', 
		trigger: 'right',
		className: 'contextmenu',
		build: function($trigger, e) {
			return {
				callback: function(key, options){
					if("unhighlight" == key){
						var word = options.$trigger.text();
						$('#highlightWord').val($('#highlightWord').val().replace("\n" + word,""));
						$('#highlightWord').val($('#highlightWord').val().replace(word,""));
						
						ls.setItem('highlightWord', $('#highlightWord').val());
						showMsg('「' + word + '」 のハイライトを解除しました。');
						applyDisplaySetting();
						$('.highlight').removeClass('context-menu-active');
					}
				},
				items: {
					"unhighlight": {name: "この文字列のハイライトを解除"}
				}
			};
		}
	});
	
	// レス表示設定適用
	applyDisplaySetting();
	
	$(".idMemo").unbind("blur");
	$(".idMemo").on("blur",function(){
		//alert($(this).parent().find('.resId').text());
		var idInfo;
		var idInfoJson;
		var id = $(this).parent().find('.resId').text().trim();
		if(null == ls.getItem('idInfo')){
			idInfoJson = {};
			idInfo = {"memo":""};
			idInfoJson[id] = idInfo;
		}else{
			idInfoJson = JSON.parse(ls.getItem('idInfo'));
			log(idInfoJson);
			
			if(null == idInfoJson[id]){
				idInfo = {"memo":""};
				idInfoJson[id] = idInfo;
			}else{
				idInfo = idInfoJson[id];
			}
		}
		
		idInfo.memo = $(this).text();
		
		ls.setItem('idInfo', JSON.stringify(idInfoJson));
		
		showIdMemo($(this));
	});
	
	Gifffer();
	
	// お絵かきのみ表示モードで現在のページにお絵かきがない場合取りに行く
	/*
	var oekakiTimer = setInterval(function(){
		if(loadProcessing) return;
		if(loadEnd && 0 == tempResNum && 0 == tempOekakiNum){
			clearInterval(oekakiTimer);
			return;
		}
		
		if($('#oekakiOnly').prop('checked') && 0 == $('div[id^=oekaki]:not(#tempOekakiResult div[id^=oekaki])').length){
			tempResNum = 0;
			tempOekakiNum = 0;
			getNewOekakiRes(false);
			
			//var beforeLastResHead = $("div[id^=oekaki]:last").parent().prev();
			//$(window).scrollTop($(beforeLastResHead).offset().top);
		}
	},500);
	*/
}

function contextMenuCallback(key, options) {
	if("res" == key){
		var resNum = ">>" + options.$trigger.prop("id").split("res")[1] + "\n";
		var s = $('#res_message').val();
		var p = $('#res_message').get(0).selectionStart;
		var np = p + resNum.length;
		$('#res_message').val(s.substr(0, p) + resNum + s.substr(p));
		$('#res_message').get(0).setSelectionRange(np, np);
		$('#res_message').get(0).focus();
	}
	if("idMemo" == key){
		options.$trigger.parent().find(".idMemo").focus();
	}
	if("ng" == key){
		var id = options.$trigger.parent().find('a.resId').text().trim();
		if(-1 < $('#ngId').val().indexOf(id)){
			showMsg('「' + id + '」 は既に登録されています。');
		}else{
			var nl = "" != $('#ngId').val() ? "\n" : "";
			$('#ngId').val($('#ngId').val() + nl + id);
			ls.setItem('ngId', $('#ngId').val());
			showMsg('「' + id + '」 をNGIDに追加しました。');
			applyDisplaySetting();
			$('.resLink').removeClass('context-menu-active');
		}
	}
	if("unng" == key){
		var id = options.$trigger.parent().find('a.resId').text().trim();
		$('#ngId').val($('#ngId').val().replace("\n" + id,""));
		$('#ngId').val($('#ngId').val().replace(id,""));
		
		ls.setItem('ngId', $('#ngId').val());
		showMsg('「' + id + '」 のNGを解除しました。');
		applyDisplaySetting();
		$('.resLink').removeClass('context-menu-active');
	}
	if("highlight" == key){
		var id = options.$trigger.parent().find('a.resId').text().trim();
		if(-1 < $('#highlightId').val().indexOf(id)){
			showMsg('「' + id + '」 は既に登録されています。');
		}else{
			var nl = "" != $('#highlightId').val() ? "\n" : "";
			$('#highlightId').val($('#highlightId').val() + nl + id);
			ls.setItem('highlightId', $('#highlightId').val());
			showMsg('「' + id + '」 をハイライトIDに追加しました。');
			applyDisplaySetting();
			$('.resLink').removeClass('context-menu-active');
		}
	}
	if("unhighlight" == key){
		var id = options.$trigger.parent().find('a.resId').text().trim();
		$('#highlightId').val($('#highlightId').val().replace("\n" + id,""));
		$('#highlightId').val($('#highlightId').val().replace(id,""));
		
		ls.setItem('highlightId', $('#highlightId').val());
		showMsg('「' + id + '」 のハイライトを解除しました。');
		applyDisplaySetting();
		$('.resLink').removeClass('context-menu-active');
	}
	if("ngWord" == key){
		var word = window.getSelection().toString().trim();
		if("" == word) return;
		if(-1 < $('#ngWord').val().indexOf(word)){
			showMsg('「' + word + '」 を含むワードが既に登録されています。');
		}else{
			var nl = "" != $('#ngWord').val() ? "\n" : "";
			$('#ngWord').val($('#ngWord').val() + nl + word);
			ls.setItem('ngWord', $('#ngWord').val());
			showMsg('「' + word + '」 をNGワードに追加しました。');
			applyDisplaySetting();
			$('.resLink').removeClass('context-menu-active');
		}
	}
	if("highlightWord" == key){
		var word = window.getSelection().toString().trim();
		if("" == word) return;
		if(-1 < $('#highlightWord').val().indexOf(word)){
			showMsg('「' + word + '」 を含むワードが既に登録されています。');
		}else{
			var nl = "" != $('#highlightWord').val() ? "\n" : "";
			$('#highlightWord').val($('#highlightWord').val() + nl + word);
			ls.setItem('highlightWord', $('#highlightWord').val());
			showMsg('「' + word + '」 をハイライトワードに追加しました。');
			applyDisplaySetting();
			$('.resLink').removeClass('context-menu-active');
		}
	}
	if("bookmark" == key){
		var resNum = options.$trigger.prop("id").split("res")[1];
		ls.setItem('bookmarkResNo@' + communityNo, resNum);
		showMsg('レス No ' + resNum + ' にしおりを登録しました。');
		$('.resLink').removeClass('context-menu-active');
	}
}

function applyNg(target){
	//var prevContents = $(target).html();
	var resNum = $(target).prev().find('a.resLink').text();
	
	if($('#transparent').prop('checked')){
		$(target).prev().hide();
		$(target).hide();
	}else{
		// NG済みなら何もしない
		if(0 != $('#ng'+ resNum + ':not(#tempOekakiResult #ng'+ resNum + ')').length){
			return false;
		}
		
		$(target).html('<span id="ng'+ resNum + '_prevContents" style="display:none;">' + $(target).html() + '</span>');
		$(target).prev().find('a.resLink').addClass('resLinkNg');
		$(target).append("<a href='' id='ng" + resNum + "' class='ngRes'>※あぼーん※</a>");
		var abone = $('#ng'+ resNum + ':not(#tempOekakiResult #ng'+ resNum + ')');
		
		$(abone).mouseenter(function(){
			setTimeout(function(){
				setBallonResAnchor($("div>.dic"));
			},0);
			
			setMouseenterBalloonEvent($(abone),$(abone).prev().html());
		});
		
		$(abone).click(function(){
			return false;
			//バルーンが表示中なら削除
			if(undefined != $(this).data("balloon")) $(this).data("balloon").remove();
			
			$(target).html($(this).prev().html());
			setTimeout(function(){
				setBallonResAnchor($(".dic"));
			},0);
			return false;
		});
		// 安価リンクからマウスが出たらバルーンを消す
		$(abone).mouseleave(function(){
			$(this).data("options").minLifetime = 300;
			$(this).hideBalloon();
		});
	}
}

// レス表示設定適用処理
var resIdArray = [];
function applyDisplaySetting(target){
	log('applyDisplaySetting');
	
	if(null == target) target = $('body');
	
	var ngWordList = $('#ngWord').val().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\n/g,'|');
	var ngIdList = $('#ngId').val().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\n/g,'|');
	var highlightIdList = $('#highlightId').val().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\n/g,'|');
	var highlightWordList = $('#highlightWord').val().trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').split("\n");
	
	// 全てのレスを一旦表示
	$(target).find('dd').show();
	$(target).find('dt').show();
	// ハイライトを一旦解除
	$(target).find('.highlight').append('<div/>').find('div').unwrap().remove();
	$(target).find('.resLinkHighlight').removeClass('resLinkHighlight');
	// あぼーんを一旦表示させる
	$(target).find('.ngRes').each(function(){
		$(this).parent().html($(this).prev().html());
		setTimeout(function(){
			setBallonResAnchor($(".dic"));
		},0);
	});
	$(target).find('.resLinkNg').removeClass('resLinkNg');
	
	$('iframe[id^=ytif_]').hide();
	$('iframe[id^=ytif_]').prev().hide();
	$('.thumbnailPictureLink').hide();
	$('.thumbnailPictureLink').prev().hide();
	
	log('お絵かきのみ表示 st '+(new Date()).getTime());
	showOekaki();
	log('お絵かきのみ表示 ed '+(new Date()).getTime());
	log('Youtubeサムネイル表示 st '+(new Date()).getTime());
	showOuterVideo();
	log('Youtubeサムネイル表示 ed '+(new Date()).getTime());
	log('画像サムネイル表示 st '+(new Date()).getTime());
	showThumbnailPicture();
	log('画像サムネイル表示 ed '+(new Date()).getTime());
	
	// IDリンク設定
	log('IDリンク設定 st '+(new Date()).getTime());
	$(".resheadNew").each(function(){
		var resHtml = $(this).html();
		var resNum = $(this).text().trim().slice(0,($(this).text().trim().indexOf('：')-1));
		var resId = $(this).text().split('ID: ')[1].trim();
		
		if(0 != $(this).find('a[id^=id]').length) return;
		
		//log('resNum:' + resNum);
		var splitIndex = resHtml.indexOf('ID: ');
		resHtml = insertStr(resHtml, resHtml.indexOf('ID: ')+4, '<a href="" id="id' + resId + '" class="resId">');
		resHtml += '</a>';
		//log('resHtml:'+resHtml);
		
		$(this).html(resHtml);
		
		if(null == resIdArray[resId]){
			var array = [];
			array.push({resNum:Number(resNum), resHead:$(this), resData:$(this).next()});
			resIdArray[resId] = array;
		}else{
			var result = $.grep(resIdArray[resId], function (e) {
				return e.resNum == resNum;
			});
			if("" == result){
				resIdArray[resId].push({resNum:Number(resNum), resHead:$(this), resData:$(this).next()});
			}
		}
		
		$(this).append('<div contenteditable class="idMemo"></div>');
	});
	$('.resId').click(function(){return false;});
	setBallonResId($('.resId'));
	log('IDリンク設定 ed '+(new Date()).getTime());
	
	log('NGワード処理 st '+(new Date()).getTime());
	if("" != ngWordList){
	log(('ngWordList '+ ngWordList));
		var regexp = new RegExp(ngWordList);
		$(target).find('dd:not(#tempOekakiResult dd)').each(function(){
			if(null != $(this).html().match(regexp)){
				applyNg($(this));
			}
		});
	}
	log('NGワード処理 ed '+(new Date()).getTime());
	
	log('NGID処理 st '+(new Date()).getTime());
	if("" != ngIdList){
	log(('ngIdList '+ ngIdList));
		var regexp = new RegExp(ngIdList);
		$(target).find('dt:not(#tempOekakiResult dt)').each(function(){
			if(null != $(this).find('.resId').html().match(regexp)){
	//log(($(this).next()));
				applyNg($(this).next());
			}
		});
	}
	log('NGID処理 ed '+(new Date()).getTime());
	
	log('ハイライトID処理 st '+(new Date()).getTime());
	if("" != highlightIdList){
		var regexp = new RegExp(highlightIdList);
		$(target).find('dt:not(#tempOekakiResult dt)').each(function(){
			if(null != $(this).find('.resId').html().match(regexp)){
				$(this).find('a.resLink').addClass('resLinkHighlight');
				$(this).find('a.resId').wrap("<span class='highlight' style='background-color:yellow;'></span>");
			}
		});
	}
	log('ハイライトID処理 ed '+(new Date()).getTime());
	
	log('ハイライトワード処理 st '+(new Date()).getTime());
	if("" != highlightWordList){
		var highlight = "";
		var params = "";
		for(var i in highlightWordList){
			highlight == "" ? highlight = "" : highlight = highlight + "|";
			highlight = highlight + '(' + highlightWordList[i] + ')';
			params = params + '$' + (Number(i)+1);
		}
		var regexp = new RegExp(highlight);

		$(target).find('dd:not(#tempOekakiResult dd)').each(function(){
			if(null != $(this).html().match(regexp)){
				log(highlight);
				log(params);
				var regexp2 = new RegExp(highlight, 'g');
				$(this).html($(this).html().replace(regexp2,"<span class='highlight' style='background-color:yellow;'>"+params+"</span>"));
				//$(this).html("<span style='background-color:yellow;'>" + $(this).html() + "</span>");
			}
		});
	}
	log('ハイライトワード処理 ed '+(new Date()).getTime());
	
	// IDメモ設定
	log('IDメモ設定 st '+(new Date()).getTime());
	showIdMemo();
	log('IDメモ設定 ed '+(new Date()).getTime());
	
	// 最近のお絵かき表示
	log('最近のお絵かき表示 st '+(new Date()).getTime());
	//showOekakiLately();
	log('最近のお絵かき表示 ed '+(new Date()).getTime());
}

function showIdMemo(){
	var idInfo;
	var idInfoJson = JSON.parse(ls.getItem('idInfo'));
	$(".idMemo").each(function(){
		var id = $(this).parent().find('.resId').text().trim();
		if(null != idInfoJson){
			
			if(null != idInfoJson[id]){
				idInfo = idInfoJson[id];
				$(this).text(idInfo.memo);
			}
		}
	});
}

function showOekakiLately(){
	if($('#oekakiLately').prop('checked') && 0 != $('#latelyOekakiDiv').length){
		log($('#newOekaki').attr('src').indexOf('blank.png'));
		if(-1 == $('#newOekaki').attr('src').indexOf('blank.png')){
			return;
		}else{
			
			tempResNum = 0;
			tempOekakiNum = 0;
			var limitCount = 0;
			var oekakiTimer = setInterval(function(){
				log('tempOekakiNum:'+tempOekakiNum);
				log('limitCount:'+limitCount);
				if(!loading1 && !loading2 && -1 != tempOekakiNum && 5 > $("div[id^=oekaki]").length){
					getNewOekakiRes(false,false,true);
					limitCount++;
				}
				
				if(limitCount > 5){
					clearInterval(oekakiTimer);
					loading(false);
					loadEnd = true;
				}
				
				
					log(tempOekakiNum);
					log($("div[id^=oekaki]"));
				if(loadEnd || -1 == tempOekakiNum || 5 <= $("div[id^=oekaki]").length){
					loading(false);
					loadEnd = true;
					clearInterval(oekakiTimer);
				
					$($("div[id^=oekaki]").get().reverse()).each(function(index){
						if(5 == index) return;
						
						var img = $(this).find('img');
						var imgInfo = $(this).parent().text().replace('画像をクリックして再生!!','').replace('この絵を基にしています！','').split('タイトル:');
						var comment = imgInfo[0].trim();
						var title = imgInfo[1].trim();
						//log($(this).attr('src'));
						var onclick = $(img).prop("onclick");
						log($(img));
						
						if(0 == index){
							$('#newOekaki').attr('src',$(img).attr('src'));
							$('#newOekaki').attr('title',comment);
							$('#oeTitle').html('【' + title + '】');
							//$('#newOekaki').attr('onclick',"HororeChuchuParero.OekakiPlayer.show_player('oekaki820740', 820740, null, 'http://dic.nicovideo.jp/b/c/co2078137')");
						}
						
						$('#thumbnailOekaki' + (index+1)).attr('src',$(img).attr('src'));
						$('#thumbnailOekaki' + (index+1)).attr('title',comment);
						$('#thumbnailOekaki' + (index+1)).click(function(){
													$('#newOekaki').attr('src',$(img).attr('src'));
													$('#newOekaki').attr('title',comment);
													$('#oeTitle').html('【' + title + '】');
												});
					});
					
					$('#latelyOekakiDiv').show();
					clearInterval(oekakiTimer);
				}
			},500);
		}
	}else{
		$('#latelyOekakiDiv').hide();
	}
}

function insertStr(str, index, insert) {
    return str.slice(0, index) + insert + str.slice(index, str.length);
}

// オートリロードを設定
function setAutoReload(){
	if($('#autoReload').prop('checked')){
		clearInterval(autoReloadTimer);
		var interval = Number($('#reloadInterval').val()) * 1000;
		autoReloadTimer = setInterval(function(){getNewRes(true)},interval);
	}else{
		clearInterval(autoReloadTimer);
	//	autoReloadTimer = setInterval(keepSession,2000000);
	}
	$('#autoReloadInterval').text($('#reloadInterval').val());
}

/*
 * 安価先レス情報取得（表示中レスから取得）
 */
function getResAnchorDisplay(anchor){
	var targetResNum = $(anchor).prop("href").split("#")[1];
	
	// 表示中のレスにあるか確認
	var currentResAArray = $('body').find('.resnumhead');
	var currentResDtArray = $('body dt');
	var currentResDdArray = $('body dd');
	
	var targetRes = null;
	for(var i=0;i<currentResAArray.length;i++){
		var resNum = Number(currentResAArray[i].name);
		//log($(currentResAArray[i]).html());
		if(targetResNum == resNum){
			targetRes = currentResDdArray[i];
			break;
		}
	}
	
	return targetRes;
}

/*
 * 安価先レス情報取得
 */
var resCache = [];
function getResAnchor(anchor){
	var targetResNum = $(anchor).prop("href").split("#")[1];
	
	if(null != resCache["res"+targetResNum]){
		setTimeout(function(){
			if(undefined != $(anchor).data("balloon")) $(anchor).data("balloon").html(resCache["res"+targetResNum]);
		},0);
		return;
	}

	var viewResNum = targetResNum - ((targetResNum-1) % 30);
	var currentResUrl = locationBaseUrl+(viewResNum)+"-";
	try{
		if(loading1) {
			log('not load1');
			return;
		}
		loading1 = true;
		log('do load1');
		log('loadUrl:' + currentResUrl);
		$('#tempResult').load(currentResUrl + " dl",
			function(text, status, xhr) {
			if('success' != status){
				$(anchor).data("balloon").html('レス取得中にエラーが発生しました。(status：' + xhr.status + ' ' + xhr.statusText + ')');
				loading1 = false;
				return false;
			}
			if(undefined != $('#tempResult .communityScale')[0]){
				$(anchor).data("balloon").html('レスが正しく取得できませんでした。ページを更新する必要があるかもしれません。');
				reacquisitionSession();
				loading1 = false;
				return false;
			}
			
			var tempResult = $('#tempResult');
			var currentResAArray = $('#tempResult').find('.resnumhead');
			var currentResTArray = $('#tempResult dt');
			var currentResDArray = $('#tempResult dd');
			
			for(var i=0;i<currentResAArray.length;i++){
				var resNum = Number(currentResAArray[i].name);
				if(targetResNum == resNum){
					$(anchor).data("balloon").html($(currentResDArray[i]).html());
					break;
				}
			}
			
			loading(false);
			initEvent();
			
			resCache["res"+targetResNum] = $(currentResDArray[i]).html();
			
			// GC
			$('#tempResult').empty();

			loading1 = false;
		});
	}catch(e){
		loading(false);
	}
	
}

// ロード中表示処理
var loadingTimeout;
function loading(on){
	//log('loading:'+on);
	clearTimeout(loadingTimeout);
	if(on){
		$('.navigate').prop("disabled", true);
		
		loadingTimeout = setTimeout(function(){
			$('#natsunoDiv').show();
			
			$('#natsunoDiv').waitMe({
					effect : 'ios',
					text : '情報を取得中',
					bg : 'rgba(255,255,255,0.0)',
					color : '#000',
					//maxSize : '',
					textPos : 'vertical'
					//fontSize : '',
					//source : ''
				});
			$('.waitMe').css('cursor',"auto");
		},1000);
	}else{
		clearTimeout(loadingTimeout);
		setTimeout(function(){$('.navigate').prop("disabled", false)},1000);
		
		$('#natsunoDiv').hide();
		$('body').waitMe('hide');
	}
}

// synchronized flag
var loading1 = false;
var loading2 = false;
var tempResNum = 0;
var tempOekakiNum = 0;
var loadEnd = false;
var loadProcessing = false;
var scrollFlag = true;
// レス取得処理
function getNewRes(next, all, background){
	var criteriaResNum;
	//log('loading1:'+loading1);
	//log('loading2:'+loading2);
	
	var oekaki = $('#oekakiOnly').prop("checked");
	
	if(!all) loading(true);
	
	$(".reshead").removeClass("resheadNew");
	
	if(next){
		// 表示している最後のレスNoを取得
		viewLastRes = $('.reshead:last');
		criteriaResNum = Number($('.resnumhead:not(#tempOekakiResult .resnumhead):last').attr('name'));
	}else{
		if(background && 0 < $('#tempOekakiResult .resnumhead:first').length){
			criteriaResNum = Number($('#tempOekakiResult .resnumhead:first').attr('name'));
		}else{
			// 現在のURLで表示しているレスNo
			criteriaResNum = Number($('.resnumhead:not(#tempOekakiResult .resnumhead):first').attr('name'));
			//log('viewResNum:' + viewResNum);
		}
		
			if(1 == criteriaResNum){
				tempOekakiNum = -1;
				if(!all) loading(false);
				loadEnd = true;
				return;
			}
	}
	
	viewResNum = criteriaResNum - ((criteriaResNum-1) % 30);

	// 現在表示しているページのURLを生成
	var currentResUrl = locationBaseUrl+(viewResNum)+"-";
	
	// 現在表示中ページにアクセスしてレス部分だけをテンポラリにセット
	try{
		if(loading1) {
			log('not load1');
			return;
		}
		loading1 = true;
		log('do load1');
		log('loadUrl:' + currentResUrl);
		var beforeFirstResHead = $('.reshead:not(#tempOekakiResult .reshead):first');
		
		$('#tempResult').load(currentResUrl + " dl",
			function(text, status, xhr) {
				if('success' != status){
					viewError('レス取得中にエラーが発生しました。(status：' + xhr.status + ' ' + xhr.statusText + ')');
					loading1 = false;
					loadEnd = true;
					tempResNum = -1;
					return false;
				}
				if(undefined != $('#tempResult .communityScale')[0]){
					viewError('レスが正しく取得できませんでした。ページを更新する必要があるかもしれません。');
					reacquisitionSession();
					loading1 = false;
					loadEnd = true;
					tempResNum = -1;
					return false;
				}
				
				criteriaResNum = getNewResTemp(next,criteriaResNum);
				
				if(undefined != $('#tempResult dt').html()){
					if(next){
						tempResNum += $("#tempResult").find(".reshead").length;
						tempOekakiNum += $("#tempResult div[id^=oekaki]").length;
						
						if(!all) showMsg('取得レス数：' + $("#tempResult").find(".reshead").length + '件');
						$("#tempResult").find(".reshead").addClass("resheadNew");
						// 描画領域にコピー
						$('#nextResult').append($('#tempResult').contents());
									
						// オートスクロール
						if($('#autoScroll').prop('checked') && (!all || (all && scrollFlag))){
							scrollFlag = false;
							$("html,body").animate({scrollTop:$('dl:last').offset().top},{duration : 1500});
						}
						deleteResEco();
					}else{
						tempResNum += $("#tempResult").find(".reshead").length;
						tempOekakiNum += $("#tempResult div[id^=oekaki]").length;
			log('ltempOekakiNum:'+tempOekakiNum);
						
						$("#tempResult").find(".reshead").addClass("resheadNew");
						var adjust = ("" == $('#prevResult').html()) ? prevResAdjustTop : prevResAdjustTop;
						
						if(oekaki && !background) $('#tempResult').contents().hide();
						// 描画領域にコピー
						if(background){
							$('#tempOekakiResult').prepend($('#tempResult').contents());
						}else{
							$('#prevResult').prepend($('#tempResult').contents());
						}
						
						//if(!oekaki && !background) $(window).scrollTop($(beforeFirstResHead).offset().top + adjust);
						//log('adjust2:'+adjust);
					}
				}else{
					// 全部削除になった場合は次のページを取得
					var incliment = next ? 30 : -30;
					var nextResUrl = locationBaseUrl+(viewResNum + incliment)+"-";
					log('nextResUrl:' + nextResUrl);
					
					if(!loading2){
						log('do load2');
						log('loadUrl:' + nextResUrl);
						$('#tempResult').load(nextResUrl + " dl",
							function(text, status, xhr) {
								if('success' != status){
									viewError('レス取得中にエラーが発生しました。(status：' + xhr.status + ' ' + xhr.statusText + ')');
									loading2 = false;
									loadEnd = true;
									tempResNum = -1;
									// GC
									$('#tempResult').empty();
									return false;
								}
								if(undefined != $('#tempResult .communityScale')[0]){
									viewError('レスが正しく取得できませんでした。ページを更新する必要があるかもしれません。');
									reacquisitionSession();
									loading2 = false;
									loadEnd = true;
									tempResNum = -1;
									// GC
									$('#tempResult').empty();
									return false;
								}
								
					  			criteriaResNum = getNewResTemp(next,criteriaResNum);
								
								// それでも取得できない場合はそこが最新
								if(undefined == $('#tempResult dt').html()){
									if(next){
										loadEnd = true;
										if(!all) showMsg('新しいレスはありません。');
									}
								}else{
									//if(!background){
										viewResNum  += incliment;
									//}
									
									if(next){
										tempResNum += $("#tempResult").find(".reshead").length;
										tempOekakiNum += $("#tempResult div[id^=oekaki]").length;
										if(!all) showMsg('取得レス数：' + $("#tempResult").find(".reshead").length + '件');
										$("#tempResult").find(".reshead").addClass("resheadNew");
										// 描画領域にコピー
										$('#nextResult').append($('#tempResult').contents());
										
										// オートスクロール
										if($('#autoScroll').prop('checked') && (!all || (all && scrollFlag))){
											scrollFlag = false;
											$("html,body").animate({scrollTop:$('dl:last').offset().top},{duration : 2000});
										}
										deleteResEco();
									}else{
										tempResNum += $("#tempResult").find(".reshead").length;
										tempOekakiNum += $("#tempResult div[id^=oekaki]").length;
			log('ltempOekakiNum:'+tempOekakiNum);
										$("#tempResult").find(".reshead").addClass("resheadNew");
										//var beforeFirstResHead = $('.reshead:first');
										var adjust = ("" == $('#prevResult').html()) ? prevResAdjustTop : prevResAdjustTop;
										
										if(oekaki && !background) $('#tempResult').contents().hide();
										// 描画領域にコピー
										if(background){
											$('#tempOekakiResult').prepend($('#tempResult').contents());
										}else{
											$('#prevResult').prepend($('#tempResult').contents());
										}
										
										//if(!oekaki && !background) $(window).scrollTop($(beforeFirstResHead).offset().top + adjust);
										//log('adjust:'+adjust);
									}
									
								}
								if(!background)initEvent();
								if(!next && !oekaki && !background) $(window).scrollTop($(beforeFirstResHead).offset().top + adjust);
								loading2 = false;
								// GC
								$('#tempResult').empty();
						});
						loading2 = true;
					}else{
						log('not load2');
					}
				}
				
				if(!all) loading(false);
				if(!background)initEvent();
				if(!next && !oekaki && !background) $(window).scrollTop($(beforeFirstResHead).offset().top + adjust);
				
				// GC
				$('#tempResult').empty();

				loading1 = false;
		});
	}catch(e){
		loading(false);
		tempResNum = -1;
	}
	
}

function getNewOekakiRes(next, all, background){
	loadEnd = false;
	scrollFlag = true;
	var searchLimit = 200;
	var msg1 = next ? '先' : '前';
	var msg2 = next ? '次' : '前';
	var pause = false;
	
	beforeFirstResHead = $("div[id^=oekaki]:first").parent().prev();
	
	if(0 == $(beforeFirstResHead).length){
		beforeFirstResHead = $('.resnumhead:not(#tempOekakiResult .resnumhead):first');
	}
	// 前を取得時のスクロール位置調整値を取得
	var adjustTop = - $(beforeFirstResHead).offset().top;
	
	try{
		if(!all) loading(true);
		var getResTimer = setInterval(function(){
			if(background) clearInterval(getResTimer);
			if(pause){log('pause'); return;}
			try{
					log(loading1);
					log(loading2);
				if(!loading1 && !loading2){
					if(loadEnd || -1 == tempOekakiNum){
						clearInterval(getResTimer);
						if(!all) loading(false);
						if(0 < tempOekakiNum){
							if(!all && !background){
								showMsg('取得お絵かき数：' + tempOekakiNum + '件');
								$('dl:has(div[id^=oekaki])').show();
							}
							
							if(!next && !background){
								$(window).scrollTop($(beforeFirstResHead).offset().top + adjustTop);
							}
							
						}else{
							if(!all && !background) showMsg('これより' + msg1 + 'のお絵かきは見つかりませんでした。');
						}
						log('loadProcessing = false');
						loadProcessing = false;
					}else{
						getNewRes(next, true, background);
					}
				}
				
				if(0 < tempOekakiNum){
					log('0 < tempOekakiNum');
					if(!all){
						loading(false);
						loadEnd = true;
					}
				}
				
				if(!all && !background){
					if(!loadEnd && searchLimit < tempResNum){
					log('pause = true');
						pause = true;
						if(confirm(msg2 + 'のお絵かきが遠すぎます。処理を続行しますか？')){
							searchLimit += 200;
						}else{
							loading(false);
							loadEnd = true;
						}
						pause = false;
					}
				}
			}catch(e){
				loadProcessing = false;
				loadEnd = true;
				loading(false);
			}
		},1500);
	}catch(e){
		clearInterval(getResTimer);
		loadProcessing = false;
		loadEnd = true;
		loading(false);
	}
}

// エコモード処理
function deleteResEco(){
	if($('#eco').prop('checked') && 400 < $('#nextResult dt').length){
		$('#prevResult').empty();
		$('.community-bbs>dl').remove();
		
		var delCount = $('#nextResult dt').length - 400;
		$('#nextResult dt').each(function(index){
			if(delCount > index){
				$(this).parent().remove();
			}
		});
	}
}

function getNewResTemp(next,criteriaResNum){
	// テンポラリから、既に表示済みのレスを削除
	var tempResult = $('#tempResult');
	var currentResAArray = $('#tempResult').find('.resnumhead');
	var currentResTArray = $('#tempResult dt');
	var currentResDArray = $('#tempResult dd');
	
	if(next){
		for(var i=0;i<currentResAArray.length;i++){
			var resNum = Number(currentResAArray[i].name);
			if(criteriaResNum >= resNum){
				$(currentResTArray[i]).remove();
				$(currentResDArray[i]).remove();
			}else{
				criteriaResNum = resNum;
			}
		}
	}else{
		for(var i=currentResAArray.length-1;i>=0;i--){
			var resNum = Number(currentResAArray[i].name);
			if(criteriaResNum <= resNum){
				$(currentResTArray[i]).remove();
				$(currentResDArray[i]).remove();
			}else{
				criteriaResNum = resNum;
			}
		}
	}
	
	return criteriaResNum;
}

// セッション復活
// ※たまにコミュトップにアクセスしないと掲示板にアクセスできなくなるよくわからない仕様のため、
// 　隠しフレーム内でコミュトップにアクセス（リロード）する
function reacquisitionSession(){
	// 試験導入
	var src = $("iframe#reacquisitionSessionFrame").attr("src");
	$("iframe#reacquisitionSessionFrame").attr("src","");
	$("iframe#reacquisitionSessionFrame").attr("src",src);
	log('★reacquisitionSession★');
}

var msgTimeout;
function showMsg(msg,time,bgcolor){
	clearTimeout(msgTimeout);
	if(null == time){
		time = 5000;
	}
	
	if($('#msgDiv').css('height') == '0px'){
		$('#msgDiv').animate({
	        height: '20px'
	    });
	}else{
		return;
	}
	
    msgTimeout = setTimeout(function(){$('#msgDiv').animate({height: '0px'});},time);
    
    $('#msgDiv').html('<div class="msgDiv">' + msg + '</div>');
    
	if(null != bgcolor){
		$('#msgDiv').css('background-color',bgcolor);
	}else{
		$('#msgDiv').css('background-color','#ffdd89');
	}

	//alert('error:'+status);
}

function viewError(msg){
	loading(false);
	
	showMsg('エラー ： ' + msg,8000,'#ff7563');
	//alert('error:'+status);
}

function log(str){
	if(debug) console.log(str);
}