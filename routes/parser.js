const express = require('express');
const router = express.Router();
const fs = require('fs');
const osmosis = require('osmosis');
const request = require('request');
const cheerio = require('cheerio');
let connection = require('../db/db');
let lineReader = require('line-reader');

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds){
            break;
        }
    }
}

String.prototype.repAll = function(search, replacement) {
    let target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

let pieces_rus = ["С", "К", "Ф", "Кр", "Л", 'п'];
let pieces_eng = ["B", "N", "Q", "K", "R", 'p'];


/* GET home page. */
router.get('/parser/id', function(req, res, next) {

    connection.query('SELECT * FROM themes', function (error, results, fields) {
        if (error) {
            console.log("Ошибка запроса к таблице themes", error);
            res.send({
                "code":400,
                "failed":"Ошибка запроса к таблице themes"
            })
        }else{

            let themes = [];
            results.forEach(function (value) {
                themes.push({
                    id: value.id,
                    theme: value.theme
                });
            });

            res.render('parser/parser', {
                title: 'Write your URL:',
                example: "http://chessproblem.ru/id13538",
                packet : "N",
                themes: themes
            });

            // database.connection.end();
        }
    });

    // database.connection.end();
});

/* GET home page. */
router.get('/parser/packet', function(req, res, next) {

    connection.query('SELECT * FROM themes', function (error, results, fields) {
        if (error) {
            console.log("Ошибка запроса к таблице themes", error);
            res.send({
                "code":400,
                "failed":"Ошибка запроса к таблице themes"
            })
        }else{

            let themes = [];
            results.forEach(function (value) {
                themes.push({
                    id: value.id,
                    theme: value.theme
                });
            });

            res.render('parser/parser', {
                title: 'Write your URL:',
                example: "http://chessproblem.ru/pages/1",
                packet : "Y",
                themes: themes
            });

            // database.connection.end();
        }
    });
});

router.post('/parser/packet', function (req, res, next) {
    let URL = req.body.url;

    request(URL, function (err, res, body) {
        if (err)
            throw err;

        // парсим DOM
        let $ = cheerio.load(body);

        let links = $('#maintable a');
        let parsing_links = [];

        links.each(function(index, value) {
            parsing_links.push(links[index].attribs.href);
        });


        parsing_links.forEach(function (value) {
            osmosis
                .get(value)
                .header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:61.0) Gecko/20100101 Firefox/61.0')
                .set({
                    'title' : '#pr_right > p > b',
                    'pieces' : '#pr_right > ul',
                    'answer': '#answer'
                })
                .data(function(data) {

                    let pieces = data.pieces;
                    let startWhite = pieces.indexOf("Белые");
                    let endWhite = pieces.indexOf("Черные");
                    let endBlack = pieces.indexOf("Просмотров");

                    let white = pieces.slice(startWhite, endWhite);
                    let black = pieces.slice(endWhite, endBlack);

                    let answer = data.answer;
                    let startAnswerText = answer.indexOf("1.");
                    let endAnswerText = answer.indexOf("Как");

                    answer = answer.slice(startAnswerText, endAnswerText);


                    // for HTML файла
                    let html = data.title;
                    html += "\n" + white;
                    html += "\n" + black;
                    html += "\n" + answer;
                    // end HTML

                    let theme = data.title;

                    //get id from url
                    let txt_name = null;

                    const regex = /[\d]+$/gm;
                    const str = value;
                    let m;

                    while ((m = regex.exec(str)) !== null) {
                        if (m.index === regex.lastIndex) {
                            regex.lastIndex++;
                        }
                        m.forEach((match, groupIndex) => {
                            txt_name = match;
                        });
                    }

                    let textFile = '"' + theme + '"\n' + white + '\n' + black + '\n' + answer;

                    fs.writeFile('parser/packet/txt/' + txt_name + '.txt', textFile, function(err) {
                        if(err) {
                            return console.log(err);
                        }
                        console.log("Файл " + txt_name + ".txt сохранён.");
                    });

                    // for HTML
                    fs.writeFile('parser/packet/html/' + txt_name + '.html', html, function(err) {
                        if(err) {
                            return console.log(err);
                        }
                        console.log("Файл " + txt_name + ".html сохранён.");
                    });

                    /**
                     * ADD TO DataBase
                     */

                    let today = new Date();
                    let new_data_parsing = {
                        "id_task" : txt_name,
                        "id_theme": req.body.theme,
                        "txt_file": textFile,
                        "original_text" : html,
                        "success" : true,
                        "active" : true,
                        "created": today,
                    };

                    connection.query('INSERT INTO parsing SET ?', new_data_parsing, function (error, results, fields) {
                        if (error) {
                            console.log("Ошибка добавления данных в БД", error);
                        }else{

                        }
                    });
                });
        })

    });

    res.render("parser/parser", {
        title: "Packet answers",
        status : "ok"
    });


});

router.post('/parser/id', function(req, res, next) {

    osmosis
        .get(req.body.url)
        .set({
            'title' : '#pr_right > p > b',
            'pieces' : '#pr_right > ul',
            'answer': '#answer'
        })
        .data(function(data) {

            let pieces = data.pieces;
            let startWhite = pieces.indexOf("Белые");
            let endWhite = pieces.indexOf("Черные");
            let endBlack = pieces.indexOf("Просмотров");

            let white = pieces.slice(startWhite, endWhite);
            let black = pieces.slice(endWhite, endBlack);

            let right_answer = data.answer;
            right_answer = right_answer.slice(right_answer.indexOf("т:") + 3, right_answer.indexOf("1."));

            let answer = data.answer;
            let startAnswerText = answer.indexOf("1.");
            let endAnswerText = answer.indexOf("Как");

            answer = answer.slice(startAnswerText, endAnswerText);

            // answer = answer.repAll(/\[[\W,\w]\]/gm, ""); //удалить квадратные скобки - [A]

            // for HTML файла
            let html = data.title;
            html += "\n" + white;
            html += "\n" + black;
            html += "\n" + answer;
            // end HTML

            let theme = data.title;

            //get id from url
            let txt_name = null;

            const regex = /[\d]+$/gm;
            const str = req.body.url;
            let m;

            while ((m = regex.exec(str)) !== null) {
                if (m.index === regex.lastIndex) {
                    regex.lastIndex++;
                }

                m.forEach((match, groupIndex) => {
                    txt_name = match;
                });
            }

            let textFile = '"' + theme + '"\n' + white + '\n' + black + '\n' + answer;

            fs.writeFile('parser/id/txt/' + txt_name + '.txt', textFile, function(err) {
                if(err) {
                    return console.log(err);
                }
                console.log("Файл " + txt_name + ".txt сохранён.");
            });

            let white_eng = white;
            let black_eng = black;
            //временно заменяем русскую нотацию на английскую
            white_eng = white_eng.repAll("С", "B");
            white_eng = white_eng.repAll("Л", "R");
            white_eng = white_eng.repAll("Кр", "K");
            white_eng = white_eng.repAll("К", "N");
            white_eng = white_eng.repAll("Ф", "Q");

            black_eng = black_eng.repAll("С", "B");
            black_eng = black_eng.repAll("Л", "R");
            black_eng = black_eng.repAll("Кр", "K");
            black_eng = black_eng.repAll("К", "N");
            black_eng = black_eng.repAll("Ф", "Q");

            let right_answer_eng = right_answer;
            right_answer_eng = right_answer_eng.repAll("С", "B");
            right_answer_eng = right_answer_eng.repAll("Л", "R");
            right_answer_eng = right_answer_eng.repAll("Кр", "K");
            right_answer_eng = right_answer_eng.repAll("К", "N");
            right_answer_eng = right_answer_eng.repAll("Ф", "Q");


            // построчное чтение файла
            sleep(1000);
            let iter = 0;
            let index_for_the_first_white_move = 0;
            let arText = [];
            let first_move = null;
            let arFirstWhiteMove = [];

            /**
             *
             * @param arText - построчный массив текстовово файла
             * @param first_move - чей первый ход
             * @param arFirstWhiteMove - массив строк первого хода белых
             * @param index_for_the_first_white_move - если первый ход за черными, то нужен индекс строки, где первый ход белых (ну такая шифровка ответов, что тут поделаешь)
             */

            function changeFile(arText, first_move = "white", arFirstWhiteMove, index_for_the_first_white_move = 0) {
                let text = [];

                //делаем первый ход для белых
                if(first_move == "black") {
                    arFirstWhiteMove.forEach(function (value, index) {
                        let temp = value;
                        if(index === 0){
                            temp = temp.repAll(/\s+/, "");
                            text.push(temp);
                        }
                        else {
                            text.push(value);
                        }
                    })
                }

                let break_index = 0;
                arText.forEach(function (value, index) {
                    if(value.indexOf("1." + right_answer) === 2){
                        break_index = index;
                        return false;
                    }
                    else {
                        if(break_index === 0) {
                            text.push(value);
                        }
                    }
                });

                //теперь начинаем переробатывать текст

                let new_text = []; // запихнем текст в новую переменную

                let isShortNotation = false;
                if(right_answer.indexOf("-") === -1) {
                    isShortNotation = true;
                }

                text.forEach(function (value, index, array) {
                    //убираем квадратные скобки и круглые скобки
                    let temp_line = value;
                    temp_line = temp_line.repAll(/\[[\w\W\\]]/gm, "");
                    temp_line = temp_line.repAll(/\(\S.\S+\)/gm, "");

                    //убираем получившиеся лишние двойные слэши //
                    temp_line = temp_line.repAll(/\/\//gm, "");

                    if(isShortNotation) {
                        //временно заменяем русскую нотацию на английскую (чтобы было проще различить К от Кр
                        temp_line = temp_line.repAll("С", "B");
                        temp_line = temp_line.repAll("Л", "R");
                        temp_line = temp_line.repAll("Кр", "K");
                        temp_line = temp_line.repAll("К", "N");
                        temp_line = temp_line.repAll("Ф", "Q");
                    }

                    if(temp_line.indexOf("но") == -1) { //пропускаем строки, где есть "но"
                        new_text.push(temp_line);
                    }
                    else {
                        temp_line = temp_line.replace("но", "");
                        temp_line += ' "Ошибка - неправильное решение"';
                        new_text.push(temp_line);
                    }
                });

                let new_text_2 = [];

                // перенос строк, подобных этому -  1...f4 2.Rh5#
                new_text.forEach(function (value, index) {
                    if((value.indexOf("1.") !== -1) && (value.indexOf("2.") !== -1) && (value.indexOf("/") === -1)) {
                        let count_spaces = value.match(/\s/g).length;

                        let spaces = "";
                        for(let i = 0; i < count_spaces; i++){
                            spaces += " ";
                        }

                        let temp_line_before_2 = value;
                        let temp_line_after_2 = value;
                        temp_line_before_2 = temp_line_before_2.slice(0, value.indexOf("2."));
                        temp_line_after_2 = temp_line_after_2.slice(value.indexOf("2."), value.length - 1);
                        temp_line_after_2 = spaces + temp_line_after_2;

                        new_text_2.push(temp_line_before_2);
                        new_text_2.push(temp_line_after_2);

                    }
                    else {
                        new_text_2.push(value);
                    }
                });

                console.log(white_eng);
                console.log(black_eng);

                let new_text_3 = [];

                let first_r = "";
                let first_b = "";
                let first_n = "";
                let first_k = "";
                let first_q = "";
                let arPawns = [];

                console.log(new_text_2);

                //попытка перевести из короткой нотации в длинную
                new_text_2.forEach(function (value, index) {
                    //сначала проходимся по всем 1.(Белые)
                    if((value.indexOf("1.") !== -1) && (value.indexOf("1...") === -1)) {
                        let start_piece = value.indexOf("1.");

                        let piece = "";

                        let isAttack = false;
                        if(value.indexOf(":") !== -1){
                            isAttack = true;
                            piece = value.slice(start_piece + 2, start_piece + 6);
                        }
                        else {
                            piece = value.slice(start_piece + 2, start_piece + 5);
                        }

                        //ладья
                        if(piece.indexOf("R") !== -1){
                            let start_first_R = white_eng.indexOf("R");
                            first_r = white_eng.slice(start_first_R, start_first_R + 3); // получим изначальную позицию коня

                            let start_R = ""; //для атаки
                            if(isAttack) {
                                if(value.indexOf("Ra") !== -1){
                                    start_R = white_eng.indexOf("Ra");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_r = white_eng.slice(start_R, start_R + 3);
                                }
                                if(value.indexOf("Rb") !== -1){
                                    start_R = white_eng.indexOf("Rb");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_r = white_eng.slice(start_R, start_R + 3);
                                }
                                if(value.indexOf("Rc") !== -1){
                                    start_R = white_eng.indexOf("Rc");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_r = white_eng.slice(start_R, start_R + 3);
                                }
                                if(value.indexOf("Rd") !== -1){
                                    start_R = white_eng.indexOf("Rd");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_r = white_eng.slice(start_R, start_R + 3);
                                }
                                if(value.indexOf("Re") !== -1){
                                    start_R = white_eng.indexOf("Re");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_r = white_eng.slice(start_R, start_R + 3);
                                }
                                if(value.indexOf("Rf") !== -1){
                                    start_R = white_eng.indexOf("Rf");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_r = white_eng.slice(start_R, start_R + 3);
                                }
                                if(value.indexOf("Rg") !== -1){
                                    start_R = white_eng.indexOf("Rg");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_r = white_eng.slice(start_R, start_R + 3);
                                }
                                if(value.indexOf("Rh") !== -1){
                                    start_R = white_eng.indexOf("Rh");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_r = white_eng.slice(start_R, start_R + 3);
                                }

                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");

                                if(piece.length == 5){
                                    piece = piece.substring(3, piece.length)
                                }
                                else {
                                    piece = piece.substring(2, piece.length)
                                }
                                piece = piece.replace("R:", "");
                                new_text_3.push("1." + first_r + ":" + piece + comment);
                            }
                            else {
                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");
                                new_text_3.push("1." + first_r + "-" + piece + comment);
                            }

                        }
                        //слон
                        else if(piece.indexOf("B") !== -1){
                            let start_first_B = white_eng.indexOf("B");
                            first_b = white_eng.slice(start_first_B, start_first_B + 3); // получим изначальную позицию коня

                            let start_B = ""; //для атаки
                            if(isAttack) {
                                if(value.indexOf("Ba") !== -1){
                                    start_B = white_eng.indexOf("Ba");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_b = white_eng.slice(start_B, start_B + 3);
                                }
                                if(value.indexOf("Bb") !== -1){
                                    start_B = white_eng.indexOf("Bb");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_b = white_eng.slice(start_B, start_B + 3);
                                }
                                if(value.indexOf("Bc") !== -1){
                                    start_B = white_eng.indexOf("Bc");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_b = white_eng.slice(start_B, start_B + 3);
                                }
                                if(value.indexOf("Bd") !== -1){
                                    start_B = white_eng.indexOf("Bd");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_b = white_eng.slice(start_B, start_B + 3);
                                }
                                if(value.indexOf("Be") !== -1){
                                    start_B = white_eng.indexOf("Be");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_b = white_eng.slice(start_B, start_B + 3);
                                }
                                if(value.indexOf("Bf") !== -1){
                                    start_B = white_eng.indexOf("Bf");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_b = white_eng.slice(start_B, start_B + 3);
                                }
                                if(value.indexOf("Bg") !== -1){
                                    start_B = white_eng.indexOf("Bg");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_b = white_eng.slice(start_B, start_B + 3);
                                }
                                if(value.indexOf("Bh") !== -1){
                                    start_B = white_eng.indexOf("Bh");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_b = white_eng.slice(start_B, start_B + 3);
                                }

                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");

                                if(piece.length == 5){
                                    piece = piece.substring(3, piece.length)
                                }
                                else {
                                    piece = piece.substring(2, piece.length)
                                }

                                piece = piece.replace("B:", "");
                                new_text_3.push("1." + first_b + ":" + piece + comment);
                            }
                            else {
                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");
                                new_text_3.push("1." + first_b + "-" + piece + comment);
                            }
                        }
                        //конь
                        else if(piece.indexOf("N") !== -1){
                            let start_first_N = white_eng.indexOf("N");
                            first_n = white_eng.slice(start_first_N, start_first_N + 3); // получим изначальную позицию коня

                            let start_N = ""; //для атаки
                            if(isAttack) {
                                if(value.indexOf("Na") !== -1){
                                    start_N = white_eng.indexOf("Na");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_n = white_eng.slice(start_N, start_N + 3);
                                }
                                if(value.indexOf("Nb") !== -1){
                                    start_N = white_eng.indexOf("Nb");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_n = white_eng.slice(start_N, start_N + 3);
                                }
                                if(value.indexOf("Nc") !== -1){
                                    start_N = white_eng.indexOf("Nc");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_n = white_eng.slice(start_N, start_N + 3);
                                }
                                if(value.indexOf("Nd") !== -1){
                                    start_N = white_eng.indexOf("Nd");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_n = white_eng.slice(start_N, start_N + 3);
                                }
                                if(value.indexOf("Ne") !== -1){
                                    start_N = white_eng.indexOf("Ne");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_n = white_eng.slice(start_N, start_N + 3);
                                }
                                if(value.indexOf("Nf") !== -1){
                                    start_N = white_eng.indexOf("Nf");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_n = white_eng.slice(start_N, start_N + 3);
                                }
                                if(value.indexOf("Ng") !== -1){
                                    start_N = white_eng.indexOf("Ng");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_n = white_eng.slice(start_N, start_N + 3);
                                }
                                if(value.indexOf("Nh") !== -1){
                                    start_N = white_eng.indexOf("Nh");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_n = white_eng.slice(start_N, start_N + 3);
                                }

                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");

                                if(piece.length == 5){
                                    piece = piece.substring(3, piece.length)
                                }
                                else {
                                    piece = piece.substring(2, piece.length)
                                }

                                piece = piece.replace("N:", "");
                                new_text_3.push("1." + first_n + ":" + piece + comment);
                            }
                            else {
                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");
                                new_text_3.push("1." + first_n + "-" + piece + comment);
                            }
                        }
                        //король
                        else if(piece.indexOf("K") !== -1){
                            let start_first_K = white_eng.indexOf("K");
                            first_k = white_eng.slice(start_first_K, start_first_K + 3); // получим изначальную позицию коня

                            let start_K = ""; //для атаки
                            if(isAttack) {
                                if(value.indexOf("Ka") !== -1){
                                    start_K = white_eng.indexOf("Ka");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_k = white_eng.slice(start_K, start_K + 3);
                                }
                                if(value.indexOf("Kb") !== -1){
                                    start_K = white_eng.indexOf("Kb");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_k = white_eng.slice(start_K, start_K + 3);
                                }
                                if(value.indexOf("Kc") !== -1){
                                    start_K = white_eng.indexOf("Kc");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_k = white_eng.slice(start_K, start_K + 3);
                                }
                                if(value.indexOf("Kd") !== -1){
                                    start_K = white_eng.indexOf("Kd");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_k = white_eng.slice(start_K, start_K + 3);
                                }
                                if(value.indexOf("Ke") !== -1){
                                    start_K = white_eng.indexOf("Ke");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_k = white_eng.slice(start_K, start_K + 3);
                                }
                                if(value.indexOf("Kf") !== -1){
                                    start_K = white_eng.indexOf("Kf");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_k = white_eng.slice(start_K, start_K + 3);
                                }
                                if(value.indexOf("Kg") !== -1){
                                    start_K = white_eng.indexOf("Kg");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_k = white_eng.slice(start_K, start_K + 3);
                                }
                                if(value.indexOf("Kh") !== -1){
                                    start_K = white_eng.indexOf("Kh");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_k = white_eng.slice(start_K, start_K + 3);
                                }

                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");

                                if(piece.length == 5){
                                    piece = piece.substring(3, piece.length)
                                }
                                else {
                                    piece = piece.substring(2, piece.length)
                                }
                                piece = piece.replace("K:", "");
                                new_text_3.push("1." + first_k + ":" + piece + comment);
                            }
                            else {
                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");
                                new_text_3.push("1." + first_k + "-" + piece + comment);
                            }
                        }
                        //ферзь
                        else if(piece.indexOf("Q") !== -1){
                            let start_first_Q = white_eng.indexOf("Q");
                            first_q = white_eng.slice(start_first_Q, start_first_Q + 3); // получим изначальную позицию коня

                            let start_Q = ""; //для атаки
                            if(isAttack) {
                                if(value.indexOf("Qa") !== -1){
                                    start_Q = white_eng.indexOf("Qa");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_q = white_eng.slice(start_Q, start_Q + 3);
                                }
                                if(value.indexOf("Qb") !== -1){
                                    start_Q = white_eng.indexOf("Qb");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_q = white_eng.slice(start_Q, start_Q + 3);
                                }
                                if(value.indexOf("Qc") !== -1){
                                    start_Q = white_eng.indexOf("Qc");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_q = white_eng.slice(start_Q, start_Q + 3);
                                }
                                if(value.indexOf("Qd") !== -1){
                                    start_Q = white_eng.indexOf("Qd");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_q = white_eng.slice(start_Q, start_Q + 3);
                                }
                                if(value.indexOf("Qe") !== -1){
                                    start_Q = white_eng.indexOf("Qe");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_q = white_eng.slice(start_Q, start_Q + 3);
                                }
                                if(value.indexOf("Qf") !== -1){
                                    start_Q = white_eng.indexOf("Qf");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_q = white_eng.slice(start_Q, start_Q + 3);
                                }
                                if(value.indexOf("Qg") !== -1){
                                    start_Q = white_eng.indexOf("Qg");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_q = white_eng.slice(start_Q, start_Q + 3);
                                }
                                if(value.indexOf("Qh") !== -1){
                                    start_Q = white_eng.indexOf("Qh");
                                    piece = value.slice(start_piece + 2, start_piece + 7);
                                    first_q = white_eng.slice(start_Q, start_Q + 3);
                                }

                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");

                                if(piece.length == 5){
                                    piece = piece.substring(3, piece.length)
                                }
                                else {
                                    piece = piece.substring(2, piece.length)
                                }

                                piece = piece.replace("Q:", "");
                                new_text_3.push("1." + first_q + ":" + piece + comment);
                            }
                            else {
                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");
                                new_text_3.push("1." + first_q + "-" + piece + comment);
                            }
                        }
                        //пешка
                        else {
                            const regex = / [abcdefgh]\w+/gm;
                            let m;
                            while ((m = regex.exec(white_eng)) !== null) {
                                if (m.index === regex.lastIndex) {
                                    regex.lastIndex++;
                                }

                                m.forEach((match) => {
                                    arPawns.push(match);
                                });
                            }

                            if(isAttack) {
                                let comment = value.replace("1." + piece, "");
                                comment = comment.repAll(/^\s+/gm, "");
                                piece = piece.substring(2, piece.length);
                                arPawns[0] = arPawns[0].replace(" ", "");
                                new_text_3.push("1." + arPawns[0] + ":" + piece + comment);
                            }
                            else {

                            }

                        }
                    }
                });


                //удаляем первые вхождения белых
                if(first_r !== "") {
                    white_eng = white_eng.replace(first_r + ",", ""); //удаляем найденную фигуру
                }
                if(first_b !== "") {
                    white_eng = white_eng.replace(first_b + ",", "");
                }
                if(first_n !== "") {
                    white_eng = white_eng.replace(first_n + ",", "");
                }
                if(first_k !== "") {
                    white_eng = white_eng.replace(first_k + ",", "");
                }
                if(first_q !== "") {
                    white_eng = white_eng.replace(first_q + ",", "");
                }

                console.log(new_text_3);
                
            }

            lineReader.eachLine('parser/id/txt/' + txt_name + '.txt', function(line, last) {
                if(iter > 2){ //пропускаем первые строки
                    //проверить, чей первый ход. Если сначала идет 1. - То белые, если 1... сначала, то черные, но надо сделать так, чтобы первый ход был за белыми
                    // то есть нужно взять правильный ответ и сделать его первым, я хз почему так, так сказано сверху, а я лупень, в шахматы не особо умею играть

                    arText.push(line);

                    if(iter === 3){
                        if(line.indexOf('1...') !== -1) { //значит черные
                            console.log("первый ход ЧЕРНЫМИ")
                            first_move = "black";
                        }
                        else {
                            console.log("первый ход БЕЛЫМИ")
                            first_move = "white";
                        }
                    }

                    if(line.indexOf("1." + right_answer) == 2){ // получить первый ход
                        index_for_the_first_white_move = iter;
                    }

                    if(index_for_the_first_white_move > 0){
                        arFirstWhiteMove.push(line);
                    }

                }

                iter++;

                if(last){
                    changeFile(arText, first_move, arFirstWhiteMove, index_for_the_first_white_move);
                }
            });


            fs.writeFile('parser/id/html/' + txt_name + '.html', html, function(err) {
                if(err) {
                    return console.log(err);
                }
                console.log("Файл " + txt_name + ".html сохранён.");
            });

            res.render("parser/parser", {
                title: req.body.url,
                name : data.title,
                white: white,
                black: black,
                result: answer,
                textFile : textFile,
                txt_name : txt_name
            });

            // /**
            //  * ADD TO DataBase
            //  */
            //
            // let today = new Date();
            // let new_data_parsing = {
            //     "id_task" : txt_name,
            //     "id_theme": req.body.theme,
            //     "txt_file": textFile,
            //     "original_text" : html,
            //     "success" : true,
            //     "active" : true,
            //     "created": today,
            // };
            //
            // connection.query('INSERT INTO parsing SET ?', new_data_parsing, function (error, results, fields) {
            //     if (error) {
            //         console.log("Ошибка добавления данных в БД", error);
            //         res.send({
            //             "code":400,
            //             "failed":"Ошибка добавления данных в БД"
            //         })
            //     }else{
            //         res.render("parser/parser", {
            //             title: req.body.url,
            //             name : data.title,
            //             white: white,
            //             black: black,
            //             result: answer,
            //             textFile : textFile,
            //             txt_name : txt_name
            //         });
            //     }
            // });

            // database.connection.end();


            /**
             * CLOSE CONNECTION TO DB
             */

        })
});

module.exports = router;
