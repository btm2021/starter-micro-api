import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
const app = express();
const port = process.env.PORT || 3001; // Bạn có thể thay đổi cổng tùy ý

import morgan from 'morgan';

import { DataSource } from "typeorm";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SqlDatabase } from "langchain/sql_db";
import { PromptTemplate } from "@langchain/core/prompts";
import {
    RunnablePassthrough,
    RunnableSequence,
} from "@langchain/core/runnables";
import { OpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import translate from "translate";


app.use(cors());
app.use(morgan('tiny'));

app.use(bodyParser.json());

app.post('/api', async (req, res) => {
    // const question = req.body.questionFromUI;
    let qs = req.body.question
    if (qs != null && qs != '') {
        let q = qs
        console.log(qs)
        let sql = await question(q)
        let resultQuery = await db.run(sql)
        let finalReturn = { question: q, sql, resultQuery }
        res.json(finalReturn)
    } else {
        res.json({ status: 404, message: 'Missing Q' })
    }

});


app.listen(port, () => {
    console.log(`Server đang chạy trên cổng ${port}`);
});



const template = `You are a Postgres expert. Given an input question, first create a syntactically correct Postgres query to run, then look at the results of the query and return the answer to the input question.
Always query for all columns from a table. Wrap each column name in double quotes (") to denote them as delimited identifiers.
Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.
Pay attention to use date('now') function to get the current date, if the question involves "today".
Use the following format:

Question: <Question here>
SQLQuery: <SQL Query to run>
SQLResult: <Result of the SQLQuery>
Answer: <Final answer here>

Only use the following tables:

{schema}

QUESTION: {question}
SQLQuery:`;

const prompt = PromptTemplate.fromTemplate(template);
const datasource = new DataSource({
    type: "postgres",
    host: "db.ajsrzteoovahabndebyp.supabase.co",
    port: 5432,
    username: "postgres",
    password: "trinhminhbao@1991",
    database: "postgres",
});

const llm = new OpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.7
});


const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
});

async function question(q) {

    const textTrain = await translate(q, { to: "en", from: "vi" })
    //console.log(textTrain)


    const sqlQueryGeneratorChain = RunnableSequence.from([
        RunnablePassthrough.assign({
            schema: async () => db.getTableInfo(),
        }),
        prompt,
        llm.bind({ stop: ["\nSQLResult:"] }),
        new StringOutputParser(),
    ]);

    const result = await sqlQueryGeneratorChain.invoke({
        question: textTrain,
    });

    return new Promise((resolve, reject) => {
        resolve(result)
    })
}
